// A-02-04 database rules of the settings cascade (criteria 8–10). setting_value (FORCE RLS):
// shifa_app reads its own clinic's values and writes its unlocked ones, never the lock;
// shifa_platform reads a clinic's values inside it in setting actions only, and writes only a
// locked organization value (setting.locked) or removes one (setting.unlocked); shifa_auth reads
// the organization's session.idle_minutes of the person's own clinics and nothing else.
// platform_setting_value is global and read by every role. The backfill: settings-backfill.test.ts.
import { and, eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { inTenantContext, type PlatformEvent, type PlatformTx, type Tx } from '../src/index.ts';
import { membership, platformSettingValue, settingValue, user } from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = fixtureId('settings tenant A');
const B = fixtureId('settings tenant B');
const ADMIN = fixtureId('settings admin');
const PERSON = fixtureId('settings person');
const IDLE = 'session.idle_minutes';
const OTHER = 'test.other_setting';
const su = () => superuserDb(workerDatabaseName());
const [PHONE = ''] = syntheticPhones(2026_12_27, 1);

async function refusal(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    return e.code ?? e.cause?.code;
  }
  return undefined;
}

const inA = <T>(fn: (tx: Tx) => Promise<T>) =>
  testDb().withTenant({ tenantId: A, userId: PERSON }, fn);
const asPlatform = <T>(event: PlatformEvent, fn: (tx: PlatformTx) => Promise<T>): Promise<T> =>
  testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) => inTenantContext(tx, A, fn));

beforeEach(async () => {
  await createTestTenants(A, B);
  await su()
    .insert(settingValue)
    .values([
      { tenantId: A, scope: 'organization', key: IDLE, value: 15 },
      { tenantId: B, scope: 'organization', key: IDLE, value: 60 },
      { tenantId: A, scope: 'organization', key: OTHER, value: 'x' },
      { tenantId: A, scope: 'branch', scopeId: fixtureId('branch A'), key: OTHER, value: 'y' },
    ]);
});

describe('shifa_app (the clinic)', () => {
  it('reads only its own clinic’s values', async () => {
    const rows = await inA((tx) => tx.select().from(settingValue));
    expect(new Set(rows.map((r) => r.tenantId))).toEqual(new Set([A]));
    expect(rows).toHaveLength(3);
  });

  it('writes and changes its own unlocked values', async () => {
    await inA((tx) =>
      tx.insert(settingValue).values({
        tenantId: A,
        scope: 'user',
        scopeId: PERSON,
        key: OTHER,
        value: 'z',
        setBy: PERSON,
      }),
    );
    const changed = await inA((tx) =>
      tx
        .update(settingValue)
        .set({ value: 30, setBy: PERSON })
        .where(eq(settingValue.key, IDLE))
        .returning({ value: settingValue.value }),
    );
    expect(changed).toEqual([{ value: 30 }]);
  });

  it('cannot write the lock columns', async () => {
    expect(
      await refusal(() =>
        inA((tx) =>
          tx.insert(settingValue).values({
            tenantId: A,
            scope: 'user',
            scopeId: PERSON,
            key: OTHER,
            value: 1,
            locked: true,
          }),
        ),
      ),
    ).toBe('42501');
    expect(await refusal(() => inA((tx) => tx.update(settingValue).set({ locked: true })))).toBe(
      '42501',
    );
    expect(await refusal(() => inA((tx) => tx.update(settingValue).set({ scope: 'user' })))).toBe(
      '42501',
    );
  });

  it('cannot change or remove a locked value', async () => {
    await su().update(settingValue).set({ locked: true }).where(eq(settingValue.key, IDLE));
    const changed = await inA((tx) =>
      tx
        .update(settingValue)
        .set({ value: 60 })
        .where(eq(settingValue.key, IDLE))
        .returning({ id: settingValue.id }),
    );
    expect(changed).toEqual([]);
    const removed = await inA((tx) =>
      tx.delete(settingValue).where(eq(settingValue.key, IDLE)).returning({ id: settingValue.id }),
    );
    expect(removed).toEqual([]);
    const [row] = await su()
      .select()
      .from(settingValue)
      .where(and(eq(settingValue.tenantId, A), eq(settingValue.key, IDLE)));
    expect(row).toMatchObject({ value: 15, locked: true });
  });

  it('reads the platform values and writes none', async () => {
    await su()
      .insert(platformSettingValue)
      .values({ scope: 'plan', planType: 'solo', key: OTHER, value: 'p' });
    expect(await inA((tx) => tx.select().from(platformSettingValue))).toHaveLength(1);
    expect(
      await refusal(() =>
        inA((tx) =>
          tx.insert(platformSettingValue).values({ scope: 'platform', key: OTHER, value: 1 }),
        ),
      ),
    ).toBe('42501');
  });
});

describe('shifa_platform (the super admin)', () => {
  it('reads a clinic’s values only in a setting action', async () => {
    expect(await asPlatform('setting.viewed', (tx) => tx.select().from(settingValue))).toHaveLength(
      3,
    );
    expect(await asPlatform('clinic.viewed', (tx) => tx.select().from(settingValue))).toEqual([]);
  });

  it('writes a value only locked, at the organization, in setting.locked', async () => {
    const lock = (event: PlatformEvent, locked: boolean) =>
      refusal(() =>
        asPlatform(event, (tx) =>
          tx
            .update(settingValue)
            .set({ value: 60, locked })
            .where(and(eq(settingValue.key, IDLE), eq(settingValue.scope, 'organization'))),
        ),
      );
    const lockBelow = () =>
      refusal(() =>
        asPlatform('setting.locked', (tx) =>
          tx.insert(settingValue).values({
            tenantId: A,
            scope: 'user',
            scopeId: PERSON,
            key: IDLE,
            value: 60,
            locked: true,
          }),
        ),
      );
    // Outside setting.locked the row is out of reach: nothing changes.
    const viewed = await asPlatform('setting.viewed', (tx) =>
      tx
        .update(settingValue)
        .set({ value: 60, locked: true })
        .where(eq(settingValue.key, IDLE))
        .returning({ id: settingValue.id }),
    );
    expect(viewed).toEqual([]);
    expect(await lock('setting.locked', false)).toBe('42501');
    expect(await lockBelow()).toBe('42501');
    // Never a value's clinic, scope or key (UPDATE by column, security review N2).
    for (const set of [
      { key: OTHER },
      { scope: 'user' as const, scopeId: PERSON },
      { tenantId: B },
    ]) {
      expect(
        await refusal(() =>
          asPlatform('setting.locked', (tx) =>
            tx.update(settingValue).set(set).where(eq(settingValue.key, IDLE)),
          ),
        ),
      ).toBe('42501');
    }
    expect(await lock('setting.locked', true)).toBeUndefined();
    const [row] = await su()
      .select()
      .from(settingValue)
      .where(and(eq(settingValue.tenantId, A), eq(settingValue.key, IDLE)));
    expect(row).toMatchObject({ value: 60, locked: true });
  });

  it('removes only a locked organization value, in setting.unlocked', async () => {
    const remove = (event: PlatformEvent) =>
      asPlatform(event, (tx) =>
        tx
          .delete(settingValue)
          .where(eq(settingValue.key, IDLE))
          .returning({ id: settingValue.id }),
      );
    // Unlocked: nothing to remove.
    expect(await remove('setting.unlocked')).toEqual([]);
    await su().update(settingValue).set({ locked: true }).where(eq(settingValue.key, IDLE));
    expect(await refusal(() => remove('setting.locked'))).toBeUndefined();
    expect(await su().select().from(settingValue).where(eq(settingValue.key, IDLE))).toHaveLength(
      2,
    );
    expect(await remove('setting.unlocked')).toHaveLength(1);
  });
});

describe('shifa_auth (each session’s idle limit)', () => {
  it('reads session.idle_minutes of the person’s own clinics only', async () => {
    await su()
      .insert(user)
      .values({
        id: PERSON,
        name: 'شخص تجريبي',
        email: `${PERSON}@example.invalid`,
        phoneNumber: PHONE,
      });
    await su()
      .insert(membership)
      .values({
        id: fixtureId('settings membership'),
        tenantId: A,
        userId: PERSON,
        phoneE164: PHONE,
        displayName: 'موظف تجريبي',
        status: 'active',
      });
    const rows = await testAuthDb().withUser(PERSON, (tx) =>
      tx
        .select({
          tenantId: settingValue.tenantId,
          key: settingValue.key,
          value: settingValue.value,
        })
        .from(settingValue),
    );
    expect(rows).toEqual([{ tenantId: A, key: IDLE, value: 15 }]);
    // No membership, nothing.
    expect(
      await testAuthDb().withUser(ADMIN, (tx) =>
        tx.select({ tenantId: settingValue.tenantId }).from(settingValue),
      ),
    ).toEqual([]);
    // Even with another clinic set as tenant on the auth path, only the person's own clinics
    // (security review N1): the restrictive policy also requires a membership.
    const withTenant = await testAuthDb().withUser(PERSON, async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${B}, true)`);
      return tx.select({ tenantId: settingValue.tenantId }).from(settingValue);
    });
    expect(withTenant).toEqual([{ tenantId: A }]);
  });
});
