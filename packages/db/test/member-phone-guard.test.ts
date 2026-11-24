// A-01-12 (OD-103): the owner corrects a pending member's phone through shifa_app. The column
// grant lets shifa_app update `phone_e164`; the trigger `membership_phone_unbound_only` refuses a
// changed phone on any row that is bound to an account or not pending, for every role (the table
// owner included), and leaves the name edit of an active member working. A pending owner's phone
// edit by the platform (A-01-11) still passes; the invitation link follows the phone (ON UPDATE
// CASCADE).
import { and, eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { changeOwnerPhone, createClinic } from '../src/index.ts';
import { membership, setupLink, user } from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  insertMembership,
  insertUser,
  ownerDb,
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const TENANT = fixtureId('member-phone tenant');
const ADMIN = fixtureId('member-phone admin');
const PERSON = fixtureId('member-phone person');
const PENDING = fixtureId('member-phone pending');
const ACTIVE = fixtureId('member-phone active');
const [P1 = '', P2 = '', P3 = '', P4 = '', P5 = '', P6 = ''] = syntheticPhones(7712, 6);
const su = () => superuserDb(workerDatabaseName());
const scope = { tenantId: TENANT, userId: PERSON };
const code = (err: unknown) =>
  (err as { code?: string; cause?: { code?: string } }).cause?.code ??
  (err as { code?: string }).code;

const phoneOf = async (id: string) =>
  (await su().select({ p: membership.phoneE164 }).from(membership).where(eq(membership.id, id)))[0]
    ?.p;

const setPhone = (id: string, phone: string) =>
  testDb().withTenant(scope, (tx) =>
    tx
      .update(membership)
      .set({ phoneE164: phone, updatedAt: new Date() })
      .where(eq(membership.id, id))
      .returning({ id: membership.id }),
  );

beforeEach(async () => {
  await createTestTenants(TENANT);
  await testAuthDb().withAuth((tx) => insertUser(tx, { id: PERSON, phone: P2 }));
  await testDb().withTenant(scope, async (tx) => {
    await insertMembership(tx, { id: PENDING, tenantId: TENANT, phone: P1 });
    await insertMembership(tx, { id: ACTIVE, tenantId: TENANT, phone: P2, userId: PERSON });
  });
});

describe('shifa_app corrects a pending member’s phone (OD-103)', () => {
  it('holds UPDATE on membership.phone_e164', async () => {
    const { rows } = await ownerDb().execute<{ ok: boolean }>(
      sql`select has_column_privilege('shifa_app', 'public.membership'::regclass, 'phone_e164', 'UPDATE') as ok`,
    );
    expect(rows[0]?.ok).toBe(true);
  });

  it('changes a pending, unbound member’s phone', async () => {
    expect(await setPhone(PENDING, P3)).toHaveLength(1);
    expect(await phoneOf(PENDING)).toBe(P3);
  });

  it('refuses the phone of a member bound to an account', async () => {
    await expect(setPhone(ACTIVE, P3)).rejects.toSatisfy((e) => code(e) === '42501');
    expect(await phoneOf(ACTIVE)).toBe(P2);
  });

  it('refuses the phone of a deactivated, unbound member', async () => {
    await testDb().withTenant(scope, (tx) =>
      tx.update(membership).set({ status: 'deactivated' }).where(eq(membership.id, PENDING)),
    );
    await expect(setPhone(PENDING, P3)).rejects.toSatisfy((e) => code(e) === '42501');
    expect(await phoneOf(PENDING)).toBe(P1);
  });

  // The superuser bypasses RLS (the owner is held by FORCE RLS), so only the trigger refuses it
  // (owner-approved fix of the locked test, 2026-11-24).
  it('refuses it for a role that bypasses RLS too', async () => {
    await expect(
      su().execute(sql`update membership set phone_e164 = ${P4} where id = ${ACTIVE}::uuid`),
    ).rejects.toSatisfy((e) => code(e) === '42501');
    expect(await phoneOf(ACTIVE)).toBe(P2);
  });

  it('leaves the name edit of an active member working (same phone or no phone column)', async () => {
    const renamed = await testDb().withTenant(scope, (tx) =>
      tx
        .update(membership)
        .set({ displayName: 'اسم مصحح', updatedAt: new Date() })
        .where(eq(membership.id, ACTIVE))
        .returning({ id: membership.id }),
    );
    expect(renamed).toHaveLength(1);
    // Setting the same phone is no change: the trigger lets it through.
    expect(await setPhone(ACTIVE, P2)).toHaveLength(1);
  });

  it('a pending member’s invitation link follows the new phone', async () => {
    await testAuthDb().withAuth((tx) =>
      insertUser(tx, { id: fixtureId('member-phone invited'), phone: P5 }),
    );
    await testDb().withTenant(scope, async (tx) => {
      await tx.update(membership).set({ phoneE164: P5 }).where(eq(membership.id, PENDING));
      await tx.insert(setupLink).values({
        tenantId: TENANT,
        membershipId: PENDING,
        purpose: 'invitation',
        tokenHash: 'b2'.repeat(32),
        expiresAt: new Date(Date.now() + 3_600_000),
        invitedPhone: P5,
      });
    });
    await testAuthDb().withAuth((tx) =>
      insertUser(tx, { id: fixtureId('member-phone invited 2'), phone: P6 }),
    );
    expect(await setPhone(PENDING, P6)).toHaveLength(1);
    const [link] = await su()
      .select({ p: setupLink.invitedPhone })
      .from(setupLink)
      .where(and(eq(setupLink.membershipId, PENDING)));
    expect(link?.p).toBe(P6);
    // The people are untouched.
    const people = await su().select({ p: user.phoneNumber }).from(user);
    expect(people.map((r) => r.p)).toEqual(expect.arrayContaining([P5, P6]));
  });
});

describe('the platform’s pending owner phone edit (A-01-11) still passes', () => {
  it('changes a clinic’s pending owner’s phone', async () => {
    await createTestTenants();
    const created = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'clinic.created' },
      (tx) =>
        createClinic(tx, {
          name: 'عيادة',
          type: 'solo',
          owner: {
            displayName: 'مالك',
            phoneE164: P1,
            link: {
              purpose: 'owner_setup',
              tokenHash: 'c3'.repeat(32),
              expiresAt: new Date(Date.now() + 3_600_000),
            },
          },
        }),
    );
    const id = created.ownerMembershipId ?? '';
    const changed = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'owner.phone_changed' },
      (tx) => changeOwnerPhone(tx, { tenantId: created.tenantId, membershipId: id, phoneE164: P3 }),
    );
    expect(changed).toBe(true);
    expect(await phoneOf(id)).toBe(P3);
  });
});
