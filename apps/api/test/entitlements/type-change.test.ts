// A-02 criteria 1, 3, 4 (counts), 18, 20 (rows `typeChange` and `typeSaved`): the preview of
// another type's limits against current use (non-deactivated doctors, pending included;
// non-archived branches), an override kept through the change, the move to the new plan at
// once with one audit row, and a `type_changed` history event for each limit whose plan value
// moved.
import { ClinicDetail, ClinicEntitlements, OverrideHistory, TypePreview } from '@shifa/contracts';
import { syntheticPhones } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { get, testClock } from '../identity/support.ts';
import {
  createClinicViaApi,
  patch,
  platformApp,
  platformAuditRows,
  resetDatabase,
  signedInAdmin,
} from '../platform/support.ts';
import type { TestApp } from '../support.ts';
import { addBranch, addDoctor, put } from './support.ts';

const phones = syntheticPhones(2026_12_03, 12);
const phone = (i: number) => phones[i] ?? '';
const REASON = 'استثناء مؤقت حتى افتتاح الفرع الجديد';

let app: TestApp;
let clock: FixedClock;
let admin: { cookie: string; userId: string };
let clinicId: string;

const preview = (type: string) =>
  get(app, `/platform/clinics/${clinicId}/type-preview?type=${type}`, admin.cookie);

beforeEach(async () => {
  await resetDatabase();
  clock = testClock();
  app = await platformApp(clock);
  admin = await signedInAdmin(app, clock, phone(0));
  clinicId = (await createClinicViaApi(app, admin.cookie, phone(1), { type: 'multi_branch' }))
    .clinicId;
  // The main branch plus two, one archived; three doctors, one deactivated.
  await addBranch(clinicId);
  await addBranch(clinicId);
  await addBranch(clinicId, true);
  await addDoctor(clinicId, phone(2));
  await addDoctor(clinicId, phone(3));
  await addDoctor(clinicId, phone(4), 'deactivated');
});

afterEach(async () => {
  await app.app.close();
});

describe('type change preview (row `typeChange`)', () => {
  it('shows each limit now and after, against current use, and which are over', async () => {
    const res = await preview('solo');
    expect(res.statusCode).toBe(200);
    expect(TypePreview.parse(res.json())).toEqual({
      type: 'solo',
      limits: [
        { key: 'limits.practitioners', current: 30, next: 1, used: 2, over: true },
        { key: 'limits.branches', current: 5, next: 1, used: 3, over: true },
        { key: 'limits.custom_fields', current: 20, next: 20, used: 0, over: false },
      ],
    });
    const rows = (await platformAuditRows()).filter((r) => r.event === 'clinic.type_previewed');
    expect(rows).toMatchObject([{ targetId: clinicId, data: { type: 'solo' } }]);
  });

  it('shows an override as kept', async () => {
    await put(
      app,
      `/platform/clinics/${clinicId}/overrides/limits.practitioners`,
      { value: 4, reason: REASON },
      admin.cookie,
    );
    const { limits } = TypePreview.parse((await preview('solo')).json());
    expect(limits[0]).toEqual({
      key: 'limits.practitioners',
      current: 4,
      next: 4,
      used: 2,
      over: false,
    });
  });

  it('refuses the clinic’s current type on query.type', async () => {
    const res = await preview('multi_branch');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'validation_failed', details: [{ path: 'query.type' }] },
    });
  });
});

describe('type change (row `typeSaved`, criteria 1, 3, 18, 20)', () => {
  it('moves the clinic to the new plan at once, keeps overrides, audits once', async () => {
    await put(
      app,
      `/platform/clinics/${clinicId}/overrides/limits.practitioners`,
      { value: 4, reason: REASON },
      admin.cookie,
    );
    const res = await patch(app, `/platform/clinics/${clinicId}`, { type: 'solo' }, admin.cookie);
    expect(res.statusCode).toBe(200);
    expect(ClinicDetail.parse(res.json())).toMatchObject({ id: clinicId, type: 'solo' });

    const after = ClinicEntitlements.parse(
      (await get(app, `/platform/clinics/${clinicId}/entitlements`, admin.cookie)).json(),
    );
    expect(after.plan).toBe('solo');
    expect(after.items.map((i) => [i.key, i.planValue, i.effective])).toEqual([
      ['limits.practitioners', 1, 4],
      ['limits.branches', 1, 1],
      ['limits.custom_fields', 20, 20],
    ]);

    const audit = await platformAuditRows();
    expect(audit.filter((r) => r.event === 'clinic.type_changed')).toMatchObject([
      { targetId: clinicId, data: { before: 'multi_branch', after: 'solo' } },
    ]);
    expect(audit.filter((r) => r.event === 'clinic.status_changed')).toEqual([]);

    const branches = OverrideHistory.parse(
      (
        await get(
          app,
          `/platform/clinics/${clinicId}/overrides/limits.branches/history`,
          admin.cookie,
        )
      ).json(),
    ).events;
    expect(branches).toEqual([
      {
        kind: 'type_changed',
        at: clock.now().toISOString(),
        byName: 'مشرف تجريبي',
        before: { value: 5, expiresAt: null },
        after: { value: 1, expiresAt: null },
        reason: null,
      },
    ]);
    const fields = OverrideHistory.parse(
      (
        await get(
          app,
          `/platform/clinics/${clinicId}/overrides/limits.custom_fields/history`,
          admin.cookie,
        )
      ).json(),
    ).events;
    expect(fields).toEqual([]);
  });

  it('a type and a status in one call: one type_changed row naming both', async () => {
    const res = await patch(
      app,
      `/platform/clinics/${clinicId}`,
      { type: 'multi_doctor', status: 'active' },
      admin.cookie,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ type: 'multi_doctor', status: 'active' });
    const audit = await platformAuditRows();
    expect(audit.filter((r) => r.event === 'clinic.type_changed')).toMatchObject([
      { data: { before: 'multi_branch', after: 'multi_doctor', status: 'active' } },
    ]);
  });

  it('the same type again changes nothing but the status, as before', async () => {
    const res = await patch(
      app,
      `/platform/clinics/${clinicId}`,
      { type: 'multi_branch', status: 'active' },
      admin.cookie,
    );
    expect(res.statusCode).toBe(200);
    const audit = await platformAuditRows();
    expect(audit.filter((r) => r.event === 'clinic.type_changed')).toEqual([]);
    expect(audit.filter((r) => r.event === 'clinic.status_changed')).toHaveLength(1);
  });
});
