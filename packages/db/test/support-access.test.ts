// A-02-05 database rules of support_access_grant (criteria 11–14, ADR-0050). FORCE RLS:
// - shifa_app reads its own clinic's grants (never the hand-off hash) and ends an open, unexpired
//   one only as `owner` by the person acting; it never inserts, deletes or reopens one;
// - shifa_platform reads and writes a clinic's grants inside it in support actions only: open in
//   support.opened, a hand-off in support.opened or support.handoff_issued, its own end in
//   support.ended, the close of an expired grant in any support action;
// - shifa_auth: support-access-auth.test.ts. One open grant per super admin per clinic (partial
//   unique index).
import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { inTenantContext, type PlatformEvent, type PlatformTx, type Tx } from '../src/index.ts';
import { supportAccessGrant } from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  superuserDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = fixtureId('support tenant A');
const B = fixtureId('support tenant B');
const ADMIN = fixtureId('support admin');
const OTHER_ADMIN = fixtureId('support other admin');
const OWNER = fixtureId('support owner');
const HOUR = 3_600_000;
const su = () => superuserDb(workerDatabaseName());
const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');
const HASH = hashOf('support hand-off token');

async function refusal(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    return e.code ?? e.cause?.code;
  }
  return undefined;
}

type GrantRow = typeof supportAccessGrant.$inferInsert;

/** A grant written as the superuser: open for an hour unless overridden. */
async function grant(overrides: Partial<GrantRow> = {}): Promise<string> {
  const openedAt = new Date(Date.now() - 60_000);
  const [row] = await su()
    .insert(supportAccessGrant)
    .values({
      tenantId: A,
      adminUserId: ADMIN,
      adminName: 'مشرف تجريبي',
      reason: 'مشكلة في الفروع تحتاج فحصًا',
      openedAt,
      expiresAt: new Date(openedAt.getTime() + HOUR),
      ...overrides,
    })
    .returning({ id: supportAccessGrant.id });
  if (!row) throw new Error('no grant');
  return row.id;
}

/** A grant that expired a minute ago and was never closed. */
const expiredGrant = (overrides: Partial<GrantRow> = {}) =>
  grant({
    openedAt: new Date(Date.now() - 31 * 60_000),
    expiresAt: new Date(Date.now() - 60_000),
    ...overrides,
  });

const rowOf = async (id: string) =>
  (await su().select().from(supportAccessGrant).where(eq(supportAccessGrant.id, id)))[0];

const inA = <T>(fn: (tx: Tx) => Promise<T>, userId = OWNER) =>
  testDb().withTenant({ tenantId: A, userId }, fn);
const asPlatform = <T>(event: PlatformEvent, fn: (tx: PlatformTx) => Promise<T>): Promise<T> =>
  testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) => inTenantContext(tx, A, fn));

const ownerEnd = (tx: Tx, id: string) =>
  tx
    .update(supportAccessGrant)
    .set({ endedAt: new Date(), endedBy: OWNER, endedByName: 'مالك', endReason: 'owner' })
    .where(eq(supportAccessGrant.id, id));

beforeEach(async () => {
  await createTestTenants(A, B);
});

describe('one open grant per super admin per clinic', () => {
  it('refuses a second open grant, allows another admin and a grant after the end', async () => {
    const first = await grant();
    expect(await refusal(() => grant())).toBe('23505');
    await grant({ adminUserId: OTHER_ADMIN });
    await su()
      .update(supportAccessGrant)
      .set({ endedAt: new Date(), endedBy: ADMIN, endedByName: 'مشرف', endReason: 'admin' })
      .where(eq(supportAccessGrant.id, first));
    await grant();
  });

  it('checks the reason, the duration and the end fields', async () => {
    expect(await refusal(() => grant({ reason: 'قصير' }))).toBe('23514');
    expect(await refusal(() => grant({ reason: ' مشكلة في الفروع تحتاج فحصًا' }))).toBe('23514');
    const openedAt = new Date();
    expect(
      await refusal(() => grant({ openedAt, expiresAt: new Date(openedAt.getTime() + 5 * HOUR) })),
    ).toBe('23514');
    expect(await refusal(() => grant({ endedAt: new Date() }))).toBe('23514');
    expect(
      await refusal(() => grant({ endedAt: new Date(), endReason: 'expiry', endedBy: OWNER })),
    ).toBe('23514');
    expect(await refusal(() => grant({ handoffTokenHash: 'not-a-hash' }))).toBe('23514');
  });
});

describe('shifa_app (the clinic)', () => {
  it('reads only its own clinic’s grants', async () => {
    await grant({ handoffTokenHash: HASH });
    await grant({ tenantId: B });
    const rows = await inA((tx) =>
      tx
        .select({ tenantId: supportAccessGrant.tenantId, reason: supportAccessGrant.reason })
        .from(supportAccessGrant),
    );
    expect(rows.map((r) => r.tenantId)).toEqual([A]);
  });

  it('an owner ends an open grant, as themselves, once', async () => {
    const id = await grant();
    const ended = await inA((tx) => ownerEnd(tx, id));
    expect(ended.rowCount).toBe(1);
    expect((await rowOf(id))?.endReason).toBe('owner');
    // Ended: no second end, no reopening.
    expect((await inA((tx) => ownerEnd(tx, id))).rowCount).toBe(0);
  });

  it('never ends a grant as someone else, as the admin, or an expired one', async () => {
    const id = await grant();
    expect(
      await refusal(() =>
        inA((tx) =>
          tx
            .update(supportAccessGrant)
            .set({
              endedAt: new Date(),
              endedBy: OTHER_ADMIN,
              endedByName: 'x',
              endReason: 'owner',
            })
            .where(eq(supportAccessGrant.id, id)),
        ),
      ),
    ).toBe('42501');
    expect(
      await refusal(() =>
        inA((tx) =>
          tx
            .update(supportAccessGrant)
            .set({ endedAt: new Date(), endedBy: OWNER, endedByName: 'x', endReason: 'admin' })
            .where(eq(supportAccessGrant.id, id)),
        ),
      ),
    ).toBe('42501');
    const expired = await expiredGrant({ adminUserId: OTHER_ADMIN });
    expect((await inA((tx) => ownerEnd(tx, expired))).rowCount).toBe(0);
  });

  it('never inserts, deletes, moves or extends a grant', async () => {
    const id = await grant();
    expect(
      await refusal(() =>
        inA((tx) =>
          tx.insert(supportAccessGrant).values({
            tenantId: A,
            adminUserId: OTHER_ADMIN,
            adminName: 'x',
            reason: 'سبب تجريبي طويل بما يكفي',
            expiresAt: new Date(Date.now() + HOUR),
          }),
        ),
      ),
    ).toBe('42501');
    for (const statement of [
      sql`delete from support_access_grant`,
      sql`update support_access_grant set expires_at = now() + interval '3 hours'`,
      sql`update support_access_grant set reason = 'سبب آخر طويل بما يكفي'`,
      sql`update support_access_grant set tenant_id = ${B}`,
    ]) {
      expect(await refusal(() => inA((tx) => tx.execute(statement)))).toBe('42501');
    }
    expect((await rowOf(id))?.endedAt).toBeNull();
  });

  it('a READ ONLY transaction refuses even the owner’s end (the support session’s wall)', async () => {
    const id = await grant();
    expect(
      await refusal(() =>
        testDb().withTenant({ tenantId: A, userId: OWNER, readOnly: true }, (tx) =>
          ownerEnd(tx, id),
        ),
      ),
    ).toBe('25006');
    expect((await rowOf(id))?.endedAt).toBeNull();
  });
});

describe('shifa_platform (the super admin)', () => {
  it('opens a grant only in support.opened, inside the clinic', async () => {
    const values = {
      tenantId: A,
      adminUserId: ADMIN,
      adminName: 'مشرف تجريبي',
      reason: 'مشكلة في الفروع تحتاج فحصًا',
      expiresAt: new Date(Date.now() + HOUR),
      handoffTokenHash: HASH,
      handoffExpiresAt: new Date(Date.now() + 120_000),
    };
    await asPlatform('support.opened', (tx) => tx.insert(supportAccessGrant).values(values));
    expect(
      await refusal(() =>
        asPlatform('support.listed', (tx) =>
          tx.insert(supportAccessGrant).values({ ...values, adminUserId: OTHER_ADMIN }),
        ),
      ),
    ).toBe('42501');
    expect(
      await refusal(() =>
        asPlatform('support.opened', (tx) =>
          tx.insert(supportAccessGrant).values({
            ...values,
            adminUserId: OTHER_ADMIN,
            endedAt: new Date(),
            endedBy: OTHER_ADMIN,
            endReason: 'admin',
          }),
        ),
      ),
    ).toBe('42501');
  });

  it('reads grants only in support actions, never the hash', async () => {
    await grant();
    const listed = await asPlatform('support.listed', (tx) =>
      tx.select({ id: supportAccessGrant.id }).from(supportAccessGrant),
    );
    expect(listed).toHaveLength(1);
    const elsewhere = await asPlatform('setting.viewed', (tx) =>
      tx.select({ id: supportAccessGrant.id }).from(supportAccessGrant),
    );
    expect(elsewhere).toHaveLength(0);
    expect(
      await refusal(() =>
        asPlatform('support.listed', (tx) =>
          tx.execute(sql`select handoff_token_hash from support_access_grant`),
        ),
      ),
    ).toBe('42501');
  });

  it('ends only its own grant in support.ended, and closes an expired one in any action', async () => {
    const id = await grant();
    const adminEnd = (tx: PlatformTx, endedBy: string) =>
      tx
        .update(supportAccessGrant)
        .set({
          endedAt: new Date(),
          endedBy,
          endedByName: 'مشرف',
          endReason: 'admin',
          handoffTokenHash: null,
          handoffExpiresAt: null,
        })
        .where(eq(supportAccessGrant.id, id));
    expect(await refusal(() => asPlatform('support.listed', (tx) => adminEnd(tx, ADMIN)))).toBe(
      '42501',
    );
    expect(
      await refusal(() => asPlatform('support.ended', (tx) => adminEnd(tx, OTHER_ADMIN))),
    ).toBe('42501');
    expect((await asPlatform('support.ended', (tx) => adminEnd(tx, ADMIN))).rowCount).toBe(1);
    expect((await rowOf(id))?.endReason).toBe('admin');

    const expired = await expiredGrant();
    const closed = await asPlatform('support.listed', (tx) =>
      tx
        .update(supportAccessGrant)
        .set({ endedAt: sql`expires_at`, endReason: 'expiry', handoffTokenHash: null })
        .where(eq(supportAccessGrant.id, expired)),
    );
    expect(closed.rowCount).toBe(1);
    // An open grant cannot be closed as expired early.
    const open = await grant({ adminUserId: OTHER_ADMIN });
    expect(
      await refusal(() =>
        asPlatform('support.listed', (tx) =>
          tx
            .update(supportAccessGrant)
            .set({ endedAt: sql`expires_at`, endReason: 'expiry' })
            .where(eq(supportAccessGrant.id, open)),
        ),
      ),
    ).toBe('42501');
  });

  it('issues a hand-off only on an open grant in support.handoff_issued', async () => {
    const id = await grant();
    const handoff = (tx: PlatformTx) =>
      tx
        .update(supportAccessGrant)
        .set({ handoffTokenHash: HASH, handoffExpiresAt: new Date(Date.now() + 120_000) })
        .where(eq(supportAccessGrant.id, id));
    expect((await asPlatform('support.handoff_issued', handoff)).rowCount).toBe(1);
    expect(await refusal(() => asPlatform('support.listed', handoff))).toBe('42501');
    const expired = await expiredGrant({ adminUserId: OTHER_ADMIN });
    expect(
      await refusal(() =>
        asPlatform('support.handoff_issued', (tx) =>
          tx
            .update(supportAccessGrant)
            .set({ handoffTokenHash: HASH, handoffExpiresAt: new Date(Date.now() + 120_000) })
            .where(eq(supportAccessGrant.id, expired)),
        ),
      ),
    ).toBe('42501');
  });
});

// shifa_auth's rules: support-access-auth.test.ts (split to stay under 400 lines).
