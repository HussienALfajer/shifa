// A-02-05 database rules of support_access_grant for shifa_auth (split from support-access.test.ts
// to stay under 400 lines; same assertions). The auth path reads the grant of its hand-off hash
// (withHandoff) or the signed-in super admin's (withUser), clears the hash of an open grant once,
// closes an expired grant; nothing else, even with a tenant set (review 3: never re-opens one).
import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { supportAccessGrant } from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  superuserDb,
  testAuthDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = fixtureId('support auth tenant A');
const B = fixtureId('support auth tenant B');
const ADMIN = fixtureId('support auth admin');
const OTHER_ADMIN = fixtureId('support auth other admin');
const OWNER = fixtureId('support auth owner');
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

beforeEach(async () => {
  await createTestTenants(A, B);
});

describe('shifa_auth (the support session)', () => {
  it('finds a grant by its hand-off hash and clears it once', async () => {
    const id = await grant({
      handoffTokenHash: HASH,
      handoffExpiresAt: new Date(Date.now() + 120_000),
    });
    await grant({ tenantId: B, adminUserId: OTHER_ADMIN });
    const found = await testAuthDb().withHandoff(HASH, (tx) =>
      tx.select({ id: supportAccessGrant.id }).from(supportAccessGrant),
    );
    expect(found.map((r) => r.id)).toEqual([id]);
    const use = () =>
      testAuthDb().withHandoff(
        HASH,
        (tx) =>
          tx
            .update(supportAccessGrant)
            .set({ handoffTokenHash: null, handoffExpiresAt: null })
            .where(eq(supportAccessGrant.handoffTokenHash, HASH)),
        ADMIN,
      );
    expect((await use()).rowCount).toBe(1);
    expect((await use()).rowCount).toBe(0);
  });

  it('never uses an expired hand-off or one of an ended grant', async () => {
    await grant({ handoffTokenHash: HASH, handoffExpiresAt: new Date(Date.now() - 1_000) });
    const other = hashOf('ended grant token');
    await grant({
      adminUserId: OTHER_ADMIN,
      handoffTokenHash: other,
      handoffExpiresAt: new Date(Date.now() + 120_000),
      endedAt: new Date(),
      endedBy: OWNER,
      endedByName: 'مالك',
      endReason: 'owner',
    });
    for (const [hash, admin] of [
      [HASH, ADMIN],
      [other, OTHER_ADMIN],
    ] as const) {
      const used = await testAuthDb().withHandoff(
        hash,
        (tx) =>
          tx
            .update(supportAccessGrant)
            .set({ handoffTokenHash: null, handoffExpiresAt: null })
            .where(eq(supportAccessGrant.handoffTokenHash, hash)),
        admin,
      );
      expect(used.rowCount).toBe(0);
    }
  });

  it('reads the signed-in super admin’s grants only, even with a tenant set', async () => {
    await grant();
    await grant({ adminUserId: OTHER_ADMIN, tenantId: B });
    const own = await testAuthDb().withUser(ADMIN, async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${B}, true)`);
      return tx.select({ adminUserId: supportAccessGrant.adminUserId }).from(supportAccessGrant);
    });
    expect(own.map((r) => r.adminUserId)).toEqual([ADMIN]);
    const none = await testAuthDb().withAuth((tx) =>
      tx.select({ id: supportAccessGrant.id }).from(supportAccessGrant),
    );
    expect(none).toHaveLength(0);
  });

  it('closes its own expired grant as expiry, never an open one or another’s', async () => {
    const expired = await expiredGrant();
    const open = await grant({ adminUserId: OTHER_ADMIN });
    const close = (userId: string, id: string) =>
      testAuthDb().withUser(userId, (tx) =>
        tx
          .update(supportAccessGrant)
          .set({ endedAt: sql`expires_at`, endReason: 'expiry' })
          .where(eq(supportAccessGrant.id, id)),
      );
    expect((await close(OTHER_ADMIN, expired)).rowCount).toBe(0);
    expect((await close(ADMIN, expired)).rowCount).toBe(1);
    expect((await close(OTHER_ADMIN, open)).rowCount).toBe(0);
    expect((await rowOf(open))?.endedAt).toBeNull();
    // Never as the owner or the admin: ended_by is not granted to the auth path.
    expect(
      await refusal(() =>
        testAuthDb().withUser(OTHER_ADMIN, (tx) =>
          tx
            .update(supportAccessGrant)
            .set({ endedAt: new Date(), endedBy: OTHER_ADMIN, endReason: 'admin' })
            .where(eq(supportAccessGrant.id, open)),
        ),
      ),
    ).toBe('42501');
  });

  it('never re-opens an ended grant, even with a tenant set (review 3)', async () => {
    const ended = await grant({
      handoffTokenHash: HASH,
      handoffExpiresAt: new Date(Date.now() + 120_000),
      endedAt: new Date(),
      endedBy: OWNER,
      endedByName: 'مالك',
      endReason: 'owner',
    });
    for (const attempt of [
      // As its admin, with the tenant set.
      () =>
        testAuthDb().withUser(ADMIN, async (tx) => {
          await tx.execute(sql`select set_config('app.tenant_id', ${A}, true)`);
          return tx
            .update(supportAccessGrant)
            .set({ endedAt: null, endReason: null, handoffTokenHash: null, handoffExpiresAt: null })
            .where(eq(supportAccessGrant.id, ended));
        }),
      // By the lingering hand-off hash, with the tenant set.
      () =>
        testAuthDb().withHandoff(
          HASH,
          async (tx) => {
            await tx.execute(sql`select set_config('app.tenant_id', ${A}, true)`);
            return tx
              .update(supportAccessGrant)
              .set({
                endedAt: null,
                endReason: null,
                handoffTokenHash: null,
                handoffExpiresAt: null,
              })
              .where(eq(supportAccessGrant.id, ended));
          },
          ADMIN,
        ),
    ]) {
      const result = await attempt().catch(() => ({ rowCount: 0 }));
      expect(result.rowCount).toBe(0);
    }
    expect((await rowOf(ended))?.endReason).toBe('owner');
    // A real hand-off clear on an open grant still works with the tenant set.
    const open = await grant({
      adminUserId: OTHER_ADMIN,
      handoffTokenHash: hashOf('open grant token'),
      handoffExpiresAt: new Date(Date.now() + 120_000),
    });
    const cleared = await testAuthDb().withHandoff(
      hashOf('open grant token'),
      async (tx) => {
        await tx.execute(sql`select set_config('app.tenant_id', ${A}, true)`);
        return tx
          .update(supportAccessGrant)
          .set({ handoffTokenHash: null, handoffExpiresAt: null })
          .where(eq(supportAccessGrant.id, open));
      },
      OTHER_ADMIN,
    );
    expect(cleared.rowCount).toBe(1);
  });

  it('never inserts or deletes a grant', async () => {
    await grant();
    expect(
      await refusal(() =>
        testAuthDb().withUser(ADMIN, (tx) => tx.execute(sql`delete from support_access_grant`)),
      ),
    ).toBe('42501');
    expect(
      await refusal(() =>
        testAuthDb().withUser(ADMIN, (tx) =>
          tx.insert(supportAccessGrant).values({
            tenantId: A,
            adminUserId: ADMIN,
            adminName: 'x',
            reason: 'سبب تجريبي طويل بما يكفي',
            expiresAt: new Date(Date.now() + HOUR),
          }),
        ),
      ),
    ).toBe('42501');
  });
});
