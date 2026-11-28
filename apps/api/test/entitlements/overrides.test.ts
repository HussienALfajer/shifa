// A-02 criteria 1–3, 18, 20 through the super-admin API (contract rows `sub`, `override`,
// `overrideSaved`, `overrideError`, `removeAsk`, `history` of A-02-screen-contract.md): a clinic's
// plan and keys, an override set, changed and removed with a value per key type, a mandatory
// reason and an expiry to the end of a Damascus day; one audit row per change with before and
// after and no reason text; every change in the key's history with its reason.
import { randomUUID } from 'node:crypto';
import { ClinicEntitlements, EntitlementItem, OverrideHistory } from '@shifa/contracts';
import { syntheticPhones } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { linkScope } from '../../src/access/index.ts';
import { ENTITLEMENTS, type EntitlementsPort } from '../../src/modules/entitlements/index.ts';
import { get, testClock } from '../identity/support.ts';
import {
  createClinicViaApi,
  platformApp,
  platformAuditRows,
  resetDatabase,
  type SignedInAdmin,
  signedInAdmin,
} from '../platform/support.ts';
import type { TestApp } from '../support.ts';
import { damascusDay, del, overrideEventRows, put, signInAgain } from './support.ts';

const phones = syntheticPhones(2026_12_02, 6);
const phone = (i: number) => phones[i] ?? '';
const REASON = 'طلب العيادة ثلاثة أطباء إضافيين حتى نهاية السنة';

let app: TestApp;
let clock: FixedClock;
let admin: SignedInAdmin;
let clinicId: string;

const url = (key = 'limits.practitioners') => `/platform/clinics/${clinicId}/overrides/${key}`;
const entitlements = () => get(app, `/platform/clinics/${clinicId}/entitlements`, admin.cookie);
const history = (key = 'limits.practitioners') => get(app, `${url(key)}/history`, admin.cookie);

beforeEach(async () => {
  await resetDatabase();
  clock = testClock();
  app = await platformApp(clock);
  admin = await signedInAdmin(app, clock, phone(0));
  clinicId = (await createClinicViaApi(app, admin.cookie, phone(1))).clinicId;
});

afterEach(async () => {
  await app.app.close();
});

describe('a clinic’s entitlements (criterion 1, row `sub`)', () => {
  it('answers the plan of its type and each catalogue key with plan and effective value', async () => {
    const res = await entitlements();
    expect(res.statusCode).toBe(200);
    const body = ClinicEntitlements.parse(res.json());
    expect(body).toEqual({
      plan: 'multi_doctor',
      items: [
        {
          key: 'limits.practitioners',
          kind: 'limit',
          planValue: 10,
          override: null,
          effective: 10,
          // A-02-03: use beside each limit (custom fields counted since A-03-05).
          used: 0,
        },
        {
          key: 'limits.branches',
          kind: 'limit',
          planValue: 1,
          override: null,
          effective: 1,
          used: 1,
        },
        {
          key: 'limits.custom_fields',
          kind: 'limit',
          planValue: 20,
          override: null,
          effective: 20,
          // Counted from A-03-05 (spec A-03 criterion 15).
          used: 0,
        },
      ],
    });
    const viewed = (await platformAuditRows()).filter((r) => r.event === 'entitlement.viewed');
    expect(viewed).toMatchObject([{ tenantId: null, actorId: admin.userId, targetId: clinicId }]);
  });

  it('answers 404 for a clinic that does not exist', async () => {
    const res = await get(app, `/platform/clinics/${randomUUID()}/entitlements`, admin.cookie);
    expect(res.statusCode).toBe(404);
  });
});

describe('setting an override (criteria 3, 18; rows `override`, `overrideSaved`)', () => {
  it('raises the limit until the end of the chosen Damascus day and audits it', async () => {
    const expiresAt = damascusDay(clock.now(), 30);
    const res = await put(
      app,
      url(),
      { value: 15, reason: `  ${REASON}  `, expiresAt },
      admin.cookie,
    );
    expect(res.statusCode).toBe(200);
    const item = EntitlementItem.parse(res.json());
    expect(item).toMatchObject({
      key: 'limits.practitioners',
      planValue: 10,
      effective: 15,
      override: {
        value: 15,
        reason: REASON,
        expiresAt,
        expired: false,
        setByName: 'مشرف تجريبي',
      },
    });
    expect(item.override?.setAt).toBe(clock.now().toISOString());

    const rows = (await platformAuditRows()).filter((r) => r.event === 'entitlement.override_set');
    expect(rows).toMatchObject([
      {
        tenantId: null,
        actorId: admin.userId,
        targetId: clinicId,
        data: { key: 'limits.practitioners', before: null, after: '15', expires: expiresAt },
      },
    ]);
    // The reason stays on the override and its history, never in the audit log.
    expect(JSON.stringify(rows)).not.toContain('طلب');
    expect(await overrideEventRows(clinicId)).toMatchObject([
      { key: 'limits.practitioners', kind: 'set', reason: REASON, by: admin.userId },
    ]);
  });

  it('changing an override records before and after; the same instance resolves it at once', async () => {
    await put(app, url(), { value: 15, reason: REASON }, admin.cookie);
    const port = app.app.get<EntitlementsPort>(ENTITLEMENTS);
    const scope = linkScope({ tenantId: clinicId, userId: admin.userId });
    expect(await port.value(scope, 'limits.practitioners')).toBe(15);

    const res = await put(
      app,
      url(),
      { value: 12, reason: 'تخفيض بعد مراجعة العقد' },
      admin.cookie,
    );
    expect(res.statusCode).toBe(200);
    expect(await port.value(scope, 'limits.practitioners')).toBe(12);
    const rows = (await platformAuditRows()).filter((r) => r.event === 'entitlement.override_set');
    expect(rows.at(-1)?.data).toEqual({
      key: 'limits.practitioners',
      before: '15',
      after: '12',
      expires: null,
    });
  });

  it('refuses a wrong value, a short reason and an expiry of today or before', async () => {
    const today = damascusDay(clock.now());
    const cases: [body: Record<string, unknown>, path: string][] = [
      [{ value: true, reason: REASON }, 'body.value'],
      [{ value: -1, reason: REASON }, 'body.value'],
      [{ value: 2.5, reason: REASON }, 'body.value'],
      [{ value: 15, reason: '  قصير    ' }, 'body.reason'],
      [{ value: 15 }, 'body.reason'],
      [{ value: 15, reason: 'س'.repeat(501) }, 'body.reason'],
      [{ value: 15, reason: REASON, expiresAt: today }, 'body.expiresAt'],
      [{ value: 15, reason: REASON, expiresAt: damascusDay(clock.now(), -3) }, 'body.expiresAt'],
      [{ value: 15, reason: REASON, expiresAt: '2026-13-01' }, 'body.expiresAt'],
    ];
    for (const [body, path] of cases) {
      const res = await put(app, url(), body, admin.cookie);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(res.json()).toMatchObject({
        error: { code: 'validation_failed', details: [expect.objectContaining({ path })] },
      });
    }
    expect(await overrideEventRows(clinicId)).toEqual([]);
  });

  it('answers 404 for a key outside the catalogue and for an unknown clinic', async () => {
    const unknownKey = await put(
      app,
      url('limits.unknown'),
      { value: 1, reason: REASON },
      admin.cookie,
    );
    expect(unknownKey.statusCode).toBe(404);
    const unknownClinic = await put(
      app,
      `/platform/clinics/${randomUUID()}/overrides/limits.branches`,
      { value: 1, reason: REASON },
      admin.cookie,
    );
    expect(unknownClinic.statusCode).toBe(404);
    expect((await history('limits.unknown')).statusCode).toBe(404);
  });
});

describe('removing an override (row `removeAsk`)', () => {
  it('returns the item without override, audits it, and answers 404 when none is set', async () => {
    await put(app, url(), { value: 15, reason: REASON }, admin.cookie);
    const res = await del(app, url(), admin.cookie);
    expect(res.statusCode).toBe(200);
    expect(EntitlementItem.parse(res.json())).toMatchObject({ override: null, effective: 10 });
    const rows = (await platformAuditRows()).filter(
      (r) => r.event === 'entitlement.override_removed',
    );
    expect(rows).toMatchObject([
      { targetId: clinicId, data: { key: 'limits.practitioners', before: '15', after: null } },
    ]);
    expect((await del(app, url(), admin.cookie)).statusCode).toBe(404);
  });
});

describe('expiry (criterion 3)', () => {
  it('stops counting at the end of its Damascus day, shown expired and in the history', async () => {
    const expiresAt = damascusDay(clock.now(), 1);
    await put(app, url(), { value: 15, reason: REASON, expiresAt }, admin.cookie);
    // The last instant of that day still counts…
    const end = new Date(`${damascusDay(clock.now(), 2)}T00:00:00+03:00`);
    clock.set(new Date(end.getTime() - 1));
    // Two days on, the super admin's session has lapsed (15-minute idle): a new one.
    admin = await signInAgain(app, clock, admin);
    let item = ClinicEntitlements.parse((await entitlements()).json()).items[0];
    expect(item).toMatchObject({ effective: 15, override: { expired: false } });
    // …and the next one does not.
    clock.set(end);
    item = ClinicEntitlements.parse((await entitlements()).json()).items[0];
    expect(item).toMatchObject({
      effective: 10,
      override: { value: 15, expired: true, expiresAt },
    });

    const events = OverrideHistory.parse((await history()).json()).events;
    expect(events.map((e) => e.kind)).toEqual(['expired', 'set']);
    expect(events[0]).toMatchObject({
      at: end.toISOString(),
      byName: null,
      before: { value: 15, expiresAt },
      after: null,
      reason: null,
    });
  });
});

describe('history (criterion 20, row `history`)', () => {
  it('lists every change of the key, newest first, with who, values and reasons', async () => {
    await put(app, url(), { value: 15, reason: REASON }, admin.cookie);
    clock.advanceBy(60_000);
    const expiresAt = damascusDay(clock.now(), 10);
    await put(app, url(), { value: 12, reason: 'تعديل بعد اتصال المالك', expiresAt }, admin.cookie);
    clock.advanceBy(60_000);
    await del(app, url(), admin.cookie);
    await put(app, url('limits.branches'), { value: 2, reason: REASON }, admin.cookie);

    const res = await history();
    expect(res.statusCode).toBe(200);
    const { events } = OverrideHistory.parse(res.json());
    expect(events).toEqual([
      {
        kind: 'removed',
        at: clock.now().toISOString(),
        byName: 'مشرف تجريبي',
        before: { value: 12, expiresAt },
        after: null,
        reason: null,
      },
      {
        kind: 'changed',
        at: new Date(clock.now().getTime() - 60_000).toISOString(),
        byName: 'مشرف تجريبي',
        before: { value: 15, expiresAt: null },
        after: { value: 12, expiresAt },
        reason: 'تعديل بعد اتصال المالك',
      },
      {
        kind: 'set',
        at: new Date(clock.now().getTime() - 120_000).toISOString(),
        byName: 'مشرف تجريبي',
        before: null,
        after: { value: 15, expiresAt: null },
        reason: REASON,
      },
    ]);
  });
});
