// A-01-11 (OD-98, OD-99): the pending TOTP secret of a self re-enrolment is readable by the auth
// path only; shifa_platform corrects the phone of a clinic's pending owner, only in an
// owner.phone_changed action, never an active owner's or a member's, never user_id or status;
// an invitation link that names the old phone follows the new one (ON UPDATE CASCADE, run as the
// table owner) and the re-issued link replaces it.
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  changeOwnerPhone,
  createClinic,
  issueOwnerLink,
  type PlatformEvent,
  type PlatformTx,
} from '../src/index.ts';
import { membership, setupLink, twoFactor } from '../src/schema/index.ts';
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

const ADMIN = fixtureId('owner-phone admin');
const [OWNER = '', NEW_PHONE = '', DOCTOR = '', OTHER = ''] = syntheticPhones(7711, 4);
const LATER = () => new Date(Date.now() + 3_600_000);
const code = (err: unknown) => (err as { code?: string }).code;
const su = () => superuserDb(workerDatabaseName());

/** As the platform under `event`, inside the clinic's tenant (what a caller could set). */
function asPlatform<T>(
  event: PlatformEvent,
  tenantId: string,
  fn: (tx: PlatformTx) => Promise<T>,
): Promise<T> {
  return testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}

const setPhone = (tenantId: string, id: string, phone: string) => (tx: PlatformTx) =>
  tx
    .update(membership)
    .set({ phoneE164: phone, updatedAt: new Date() })
    .where(and(eq(membership.tenantId, tenantId), eq(membership.id, id)))
    .returning({ id: membership.id });

const phoneOf = async (id: string) =>
  (await su().select({ p: membership.phoneE164 }).from(membership).where(eq(membership.id, id)))[0]
    ?.p;

async function clinicWithOwner(purpose: 'owner_setup' | 'invitation', tokenHash: string) {
  return testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.created' }, (tx) =>
    createClinic(tx, {
      name: 'عيادة',
      type: 'solo',
      owner: {
        displayName: 'مالك',
        phoneE164: OWNER,
        link: { purpose, tokenHash, expiresAt: LATER() },
      },
    }),
  );
}

let tenantId: string;
let ownerId: string;

beforeEach(async () => {
  await createTestTenants();
  const created = await clinicWithOwner('owner_setup', 'a1'.repeat(32));
  tenantId = created.tenantId;
  ownerId = created.ownerMembershipId ?? '';
});

describe('two_factor pending secret (OD-98)', () => {
  it('only shifa_auth reads pending_secret and pending_last_used_step', async () => {
    for (const column of ['pending_secret', 'pending_last_used_step']) {
      for (const role of ['shifa_app', 'shifa_platform']) {
        const { rows } = await ownerDb().execute<{ ok: boolean }>(
          sql`select has_column_privilege(${role}, 'public.two_factor'::regclass, ${column}, 'SELECT') as ok`,
        );
        expect(rows[0]?.ok, `${role} ${column}`).toBe(false);
      }
    }
    const userId = randomUUID();
    await testAuthDb().withAuth(async (tx) => {
      await insertUser(tx, { id: userId, phone: OTHER });
      await tx.insert(twoFactor).values({
        userId,
        secret: 'sealed-old',
        backupCodes: '[]',
        pendingSecret: 'sealed-new',
        pendingLastUsedStep: 12,
      });
    });
    const [row] = await testAuthDb().withAuth((tx) =>
      tx
        .select({ s: twoFactor.pendingSecret, step: twoFactor.pendingLastUsedStep })
        .from(twoFactor)
        .where(eq(twoFactor.userId, userId)),
    );
    expect(row).toEqual({ s: 'sealed-new', step: 12 });
  });
});

describe('pending owner’s phone (OD-99)', () => {
  it('changes in an owner.phone_changed action, through changeOwnerPhone()', async () => {
    const changed = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'owner.phone_changed' },
      (tx) => changeOwnerPhone(tx, { tenantId, membershipId: ownerId, phoneE164: NEW_PHONE }),
    );
    expect(changed).toBe(true);
    expect(await phoneOf(ownerId)).toBe(NEW_PHONE);
  });

  it('changes nothing in any other platform action', async () => {
    for (const event of ['owner.link_issued', 'clinic.status_changed', 'clinic.created'] as const) {
      const rows = await asPlatform(event, tenantId, setPhone(tenantId, ownerId, NEW_PHONE));
      expect(rows, event).toEqual([]);
    }
    expect(await phoneOf(ownerId)).toBe(OWNER);
  });

  it('never an owner with an account', async () => {
    const userId = randomUUID();
    await testAuthDb().withAuth((tx) => insertUser(tx, { id: userId, phone: OWNER }));
    await su()
      .update(membership)
      .set({ userId, status: 'active' })
      .where(eq(membership.id, ownerId));
    const rows = await asPlatform(
      'owner.phone_changed',
      tenantId,
      setPhone(tenantId, ownerId, NEW_PHONE),
    );
    expect(rows).toEqual([]);
    const changed = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'owner.phone_changed' },
      (tx) => changeOwnerPhone(tx, { tenantId, membershipId: ownerId, phoneE164: NEW_PHONE }),
    );
    expect(changed).toBe(false);
    expect(await phoneOf(ownerId)).toBe(OWNER);
  });

  it('never a member who is not the owner', async () => {
    const doctorId = randomUUID();
    await testDb().withTenant({ tenantId, userId: randomUUID() }, (tx) =>
      insertMembership(tx, { id: doctorId, tenantId, phone: DOCTOR }),
    );
    const rows = await asPlatform(
      'owner.phone_changed',
      tenantId,
      setPhone(tenantId, doctorId, NEW_PHONE),
    );
    expect(rows).toEqual([]);
    expect(await phoneOf(doctorId)).toBe(DOCTOR);
  });

  it('never user_id, status or the name (column privileges)', async () => {
    for (const column of ['user_id', 'status', 'display_name', 'tenant_id']) {
      const outcome = await asPlatform('owner.phone_changed', tenantId, (tx) =>
        tx.execute(
          sql`update membership set ${sql.identifier(column)} = ${column === 'user_id' || column === 'tenant_id' ? randomUUID() : 'active'} where id = ${ownerId}`,
        ),
      ).catch(code);
      expect(outcome, column).toBe('42501');
    }
  });

  it('an invitation link naming the old phone follows the new one, then is replaced', async () => {
    await createTestTenants();
    const created = await clinicWithOwner('invitation', 'b2'.repeat(32));
    const id = created.ownerMembershipId ?? '';
    await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'owner.phone_changed' },
      async (tx) => {
        expect(
          await changeOwnerPhone(tx, {
            tenantId: created.tenantId,
            membershipId: id,
            phoneE164: NEW_PHONE,
          }),
        ).toBe(true);
        await issueOwnerLink(tx, {
          tenantId: created.tenantId,
          membershipId: id,
          purpose: 'invitation',
          tokenHash: 'c3'.repeat(32),
          expiresAt: LATER(),
        });
      },
    );
    const links = await su()
      .select({
        hash: setupLink.tokenHash,
        phone: setupLink.invitedPhone,
        replacedAt: setupLink.replacedAt,
      })
      .from(setupLink)
      .where(eq(setupLink.membershipId, id));
    expect(links.find((l) => l.hash === 'b2'.repeat(32))).toMatchObject({ phone: NEW_PHONE });
    expect(links.find((l) => l.hash === 'b2'.repeat(32))?.replacedAt).not.toBeNull();
    expect(links.find((l) => l.hash === 'c3'.repeat(32))).toMatchObject({
      phone: NEW_PHONE,
      replacedAt: null,
    });
  });

  it('the old link cannot be replaced outside owner.link_issued or owner.phone_changed', async () => {
    const rows = await asPlatform('clinic.status_changed', tenantId, (tx) =>
      tx
        .update(setupLink)
        .set({ replacedAt: new Date() })
        .where(eq(setupLink.membershipId, ownerId))
        .returning({ id: setupLink.id }),
    );
    expect(rows).toEqual([]);
  });
});
