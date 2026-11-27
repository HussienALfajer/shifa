// A-02 criteria 8, 9 and 18 (contract rows `set`, `setClinic`, `setLocked`, `setDialog`,
// `unlockAsk` of «الإعدادات»): the super admin reads every setting of a clinic with its effective
// value and source, locks a value («قفل بقيمة», value and lock always together) or unlocks it; no
// plain set. A key that cannot be locked answers 409 `setting_not_lockable`; a value the key's
// schema refuses 400 on body.value; an unknown clinic or key 404, as unlocking a key not locked.
// One audit row per action: setting.viewed, setting.locked, setting.unlocked (key, scope, before,
// after).
import { randomUUID } from 'node:crypto';
import { ClinicSettingList, ErrorEnvelope, SettingView } from '@shifa/contracts';
import { syntheticPhones } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { del, put } from '../entitlements/support.ts';
import { get, testClock } from '../identity/support.ts';
import {
  createClinicViaApi,
  platformApp,
  resetDatabase,
  type SignedInAdmin,
  signedInAdmin,
} from '../platform/support.ts';
import type { TestApp } from '../support.ts';
import {
  clearPlatformValues,
  NOT_LOCKABLE,
  setOrganizationValue,
  setPlatformValue,
  settingAuditRows,
  storedValues,
  TEST_SETTINGS,
} from './support.ts';

const IDLE = 'session.idle_minutes';
const phones = syntheticPhones(2026_12_28, 4);

let app: TestApp;
let clock: FixedClock;
let admin: SignedInAdmin;
let clinicId: string;

beforeAll(async () => {
  await resetDatabase();
  clock = testClock();
  app = await platformApp(clock, { settings: TEST_SETTINGS });
  admin = await signedInAdmin(app, clock, phones[0] ?? '');
  clinicId = (await createClinicViaApi(app, admin.cookie, phones[1] ?? '', { type: 'solo' }))
    .clinicId;
});

afterAll(async () => {
  await app.app.close();
});

beforeEach(async () => {
  await clearPlatformValues();
});

const list = (id = clinicId) => get(app, `/platform/clinics/${id}/settings`, admin.cookie);
const lock = (key: string, value: unknown, id = clinicId) =>
  put(app, `/platform/clinics/${id}/settings/${key}/lock`, { value }, admin.cookie);
const unlock = (key: string, id = clinicId) =>
  del(app, `/platform/clinics/${id}/settings/${key}/lock`, admin.cookie);
const settingOf = async (key: string) =>
  ClinicSettingList.parse((await list()).json()).settings.find((s) => s.key === key);
const codeOf = (res: { json(): unknown }) => ErrorEnvelope.parse(res.json()).error.code;

describe('GET /platform/clinics/:id/settings (rows `set`, `setClinic`)', () => {
  it('lists every setting with its default as source, lockable and its choices', async () => {
    const res = await list();
    expect(res.statusCode, res.body).toBe(200);
    expect(ClinicSettingList.parse(res.json())).toEqual({
      settings: [
        {
          key: IDLE,
          value: 30,
          source: 'default',
          locked: false,
          lockedBy: null,
          lockable: true,
          choices: [15, 30, 60],
        },
        {
          key: NOT_LOCKABLE,
          value: 'quiet',
          source: 'default',
          locked: false,
          lockedBy: null,
          lockable: false,
          choices: ['quiet', 'loud'],
        },
      ],
    });
    const rows = await settingAuditRows('setting.viewed', clinicId);
    expect(rows.at(-1)).toMatchObject({ tenantId: null, actorId: admin.userId });
  });

  it('names the clinic’s own value, a plan value and a platform value as their source', async () => {
    await setPlatformValue(IDLE, 60);
    expect(await settingOf(IDLE)).toMatchObject({ value: 60, source: 'platform' });
    await setPlatformValue(IDLE, 15, { planType: 'solo' });
    expect(await settingOf(IDLE)).toMatchObject({ value: 15, source: 'plan' });
    await setOrganizationValue(clinicId, IDLE, 30);
    expect(await settingOf(IDLE)).toMatchObject({
      value: 30,
      source: 'organization',
      locked: false,
    });
    // A plan value of another type does not apply.
    await clearPlatformValues();
    await setPlatformValue(IDLE, 60, { planType: 'multi_branch' });
    expect(await settingOf(IDLE)).toMatchObject({ value: 30, source: 'organization' });
  });

  it('skips a stored value the key’s schema no longer accepts', async () => {
    await setOrganizationValue(clinicId, IDLE, 45);
    expect(await settingOf(IDLE)).toMatchObject({ value: 30, source: 'default' });
    await setOrganizationValue(clinicId, IDLE, 30);
  });

  it('answers 404 for a clinic that does not exist', async () => {
    const res = await list(randomUUID());
    expect(res.statusCode).toBe(404);
    expect(codeOf(res)).toBe('not_found');
  });
});

describe('PUT /platform/clinics/:id/settings/:key/lock (rows `setDialog` → `setLocked`)', () => {
  it('sets and locks the value at the organization; one setting.locked row', async () => {
    await setOrganizationValue(clinicId, IDLE, 30);
    const res = await lock(IDLE, 15);
    expect(res.statusCode, res.body).toBe(200);
    expect(SettingView.parse(res.json())).toEqual({
      key: IDLE,
      value: 15,
      source: 'organization',
      locked: true,
      lockedBy: 'organization',
      lockable: true,
      choices: [15, 30, 60],
    });
    expect(await settingOf(IDLE)).toMatchObject({ value: 15, locked: true });
    const stored = (await storedValues(clinicId)).filter((r) => r.key === IDLE);
    expect(stored).toEqual([
      expect.objectContaining({
        scope: 'organization',
        value: 15,
        locked: true,
        setBy: admin.userId,
      }),
    ]);
    const rows = await settingAuditRows('setting.locked', clinicId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenantId: null,
      actorId: admin.userId,
      data: { key: IDLE, scope: 'organization', before: '30', after: '15' },
    });
  });

  it('changes a locked value (still locked)', async () => {
    const res = await lock(IDLE, 60);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ value: 60, locked: true });
    expect((await settingAuditRows('setting.locked', clinicId)).at(-1)).toMatchObject({
      data: { before: '15', after: '60' },
    });
  });

  it('refuses a value the key’s schema does not accept (400 body.value)', async () => {
    for (const value of [20, 'thirty', true]) {
      const res = await lock(IDLE, value);
      expect(res.statusCode, String(value)).toBe(400);
      expect(ErrorEnvelope.parse(res.json()).error).toMatchObject({
        code: 'validation_failed',
        details: [{ path: 'body.value' }],
      });
    }
    expect(await settingOf(IDLE)).toMatchObject({ value: 60 });
  });

  it('answers 409 setting_not_lockable for a key that cannot be locked', async () => {
    const res = await lock(NOT_LOCKABLE, 'loud');
    expect(res.statusCode).toBe(409);
    expect(codeOf(res)).toBe('setting_not_lockable');
    expect((await storedValues(clinicId)).filter((r) => r.key === NOT_LOCKABLE)).toEqual([]);
  });

  it('answers 409 setting_not_lockable while the platform locks the key for every clinic', async () => {
    await setPlatformValue(IDLE, 30, { locked: true });
    expect(await settingOf(IDLE)).toMatchObject({
      value: 30,
      source: 'platform',
      locked: true,
      lockedBy: 'platform',
      lockable: false,
    });
    const res = await lock(IDLE, 15);
    expect(res.statusCode).toBe(409);
    expect(codeOf(res)).toBe('setting_not_lockable');
  });

  it('answers 404 for an unknown key or clinic and 400 for a malformed key', async () => {
    expect((await lock('session.unknown', 15)).statusCode).toBe(404);
    expect((await lock(IDLE, 15, randomUUID())).statusCode).toBe(404);
    const malformed = await lock('Not-A-Key', 15);
    expect(malformed.statusCode).toBe(400);
    expect(ErrorEnvelope.parse(malformed.json()).error.details).toEqual([
      { path: 'params.key', code: 'invalid_format' },
    ]);
  });
});

describe('DELETE /platform/clinics/:id/settings/:key/lock (row `unlockAsk`)', () => {
  it('unlocks: the value is inherited again; one setting.unlocked row', async () => {
    const res = await unlock(IDLE);
    expect(res.statusCode, res.body).toBe(200);
    expect(SettingView.parse(res.json())).toMatchObject({
      key: IDLE,
      value: 30,
      source: 'default',
      locked: false,
      lockedBy: null,
    });
    expect((await storedValues(clinicId)).filter((r) => r.key === IDLE)).toEqual([]);
    const rows = await settingAuditRows('setting.unlocked', clinicId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenantId: null,
      data: { key: IDLE, scope: 'organization', before: '60', after: '30' },
    });
  });

  it('answers 404 when the key is not locked for the clinic', async () => {
    expect((await unlock(IDLE)).statusCode).toBe(404);
    await setOrganizationValue(clinicId, IDLE, 15);
    const res = await unlock(IDLE);
    expect(res.statusCode).toBe(404);
    expect(codeOf(res)).toBe('not_found');
    expect(await settingOf(IDLE)).toMatchObject({ value: 15, source: 'organization' });
    expect((await unlock('session.unknown')).statusCode).toBe(404);
  });
});

describe('access', () => {
  it('needs a super admin', async () => {
    const res = await app.app.inject({
      method: 'GET',
      url: `/platform/clinics/${clinicId}/settings`,
    });
    expect(res.statusCode).toBe(401);
  });
});
