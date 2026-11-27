// A-02-05 review findings 5, 6 and 8 on support_access_grant: the platform's writes are tied to the
// acting super admin (app.user_id = the actor of withPlatformAdmin), a grant is opened now and lasts
// at most 4 hours by the database's clock, a hand-off lives at most minutes, support.opened only
// inserts, nobody is named as ending an open grant, and the clinic never records an owner's end as
// the grant's own super admin or at another time.
import { eq } from 'drizzle-orm';
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

const A = fixtureId('support review tenant A');
const ADMIN = fixtureId('support review admin');
const OTHER_ADMIN = fixtureId('support review other admin');
const OWNER = fixtureId('support review owner');
const MINUTE = 60_000;
const HASH = 'a'.repeat(64);
const su = () => superuserDb(workerDatabaseName());

async function refusal(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    return e.code ?? e.cause?.code;
  }
  return undefined;
}

const asPlatform = <T>(
  event: PlatformEvent,
  fn: (tx: PlatformTx) => Promise<T>,
  actorId = ADMIN,
): Promise<T> =>
  testPlatformDb().withPlatformAdmin({ actorId, event }, (tx) => inTenantContext(tx, A, fn));
const inA = <T>(fn: (tx: Tx) => Promise<T>, userId: string) =>
  testDb().withTenant({ tenantId: A, userId }, fn);

const values = (overrides: Partial<typeof supportAccessGrant.$inferInsert> = {}) => {
  const openedAt = new Date();
  return {
    tenantId: A,
    adminUserId: ADMIN,
    adminName: 'مشرف تجريبي',
    reason: 'مشكلة في الفروع تحتاج فحصًا',
    openedAt,
    expiresAt: new Date(openedAt.getTime() + 60 * MINUTE),
    handoffTokenHash: HASH,
    handoffExpiresAt: new Date(openedAt.getTime() + 2 * MINUTE),
    ...overrides,
  };
};

async function openGrant(adminUserId = ADMIN): Promise<string> {
  const [row] = await su()
    .insert(supportAccessGrant)
    .values(values({ adminUserId, handoffTokenHash: null, handoffExpiresAt: null }))
    .returning({ id: supportAccessGrant.id });
  if (!row) throw new Error('no grant');
  return row.id;
}

beforeEach(async () => {
  await createTestTenants(A);
});

describe('shifa_platform is tied to the acting super admin (review 5, 6)', () => {
  it('opens only its own grant', async () => {
    const insert = (adminUserId: string) =>
      asPlatform('support.opened', (tx) =>
        tx.insert(supportAccessGrant).values(values({ adminUserId })),
      );
    expect(await refusal(() => insert(OTHER_ADMIN))).toBe('42501');
    await insert(ADMIN);
  });

  it('opens a grant now, at most 4 hours long, with a short hand-off', async () => {
    const now = Date.now();
    for (const bad of [
      values({ openedAt: new Date(now - 10 * MINUTE), expiresAt: new Date(now + 60 * MINUTE) }),
      values({ openedAt: new Date(now + 10 * MINUTE), expiresAt: new Date(now + 60 * MINUTE) }),
      values({ handoffExpiresAt: new Date(now + 30 * MINUTE) }),
    ]) {
      expect(
        await refusal(() =>
          asPlatform('support.opened', (tx) => tx.insert(supportAccessGrant).values(bad)),
        ),
      ).toBe('42501');
    }
  });

  it('issues a hand-off only in support.handoff_issued, on its own grant, minutes long', async () => {
    const mine = await openGrant();
    const theirs = await openGrant(OTHER_ADMIN);
    const handoff =
      (id: string, minutes = 2) =>
      (tx: PlatformTx) =>
        tx
          .update(supportAccessGrant)
          .set({
            handoffTokenHash: HASH,
            handoffExpiresAt: new Date(Date.now() + minutes * MINUTE),
          })
          .where(eq(supportAccessGrant.id, id));
    expect(await refusal(() => asPlatform('support.opened', handoff(mine)))).toBe('42501');
    expect(await refusal(() => asPlatform('support.handoff_issued', handoff(theirs)))).toBe(
      '42501',
    );
    expect(await refusal(() => asPlatform('support.handoff_issued', handoff(mine, 30)))).toBe(
      '42501',
    );
    expect((await asPlatform('support.handoff_issued', handoff(mine))).rowCount).toBe(1);
  });

  it('ends a grant as admin only when it is the actor’s own', async () => {
    const theirs = await openGrant(OTHER_ADMIN);
    const end = (tx: PlatformTx) =>
      tx
        .update(supportAccessGrant)
        .set({ endedAt: new Date(), endedBy: OTHER_ADMIN, endedByName: 'م', endReason: 'admin' })
        .where(eq(supportAccessGrant.id, theirs));
    // Acting as ADMIN: the grant's own admin is someone else.
    expect(await refusal(() => asPlatform('support.ended', end))).toBe('42501');
    expect((await asPlatform('support.ended', end, OTHER_ADMIN)).rowCount).toBe(1);
  });
});

describe('the grant row (review 5)', () => {
  it('names nobody as ending an open grant', async () => {
    expect(
      await refusal(() =>
        su()
          .insert(supportAccessGrant)
          .values(values({ endedBy: OWNER, handoffTokenHash: null, handoffExpiresAt: null })),
      ),
    ).toBe('23514');
    expect(
      await refusal(() =>
        su()
          .insert(supportAccessGrant)
          .values(values({ endedByName: 'مالك', handoffTokenHash: null, handoffExpiresAt: null })),
      ),
    ).toBe('23514');
  });
});

describe('the owner’s end (review 8)', () => {
  it('is never recorded as the grant’s super admin, nor at another time', async () => {
    const id = await openGrant();
    const end = (endedBy: string, endedAt: Date) => (tx: Tx) =>
      tx
        .update(supportAccessGrant)
        .set({ endedAt, endedBy, endedByName: 'مالك', endReason: 'owner' })
        .where(eq(supportAccessGrant.id, id));
    expect(await refusal(() => inA(end(ADMIN, new Date()), ADMIN))).toBe('42501');
    expect(await refusal(() => inA(end(OWNER, new Date(Date.now() - 60 * MINUTE)), OWNER))).toBe(
      '42501',
    );
    expect((await inA(end(OWNER, new Date()), OWNER)).rowCount).toBe(1);
  });
});
