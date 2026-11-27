// A-02 criteria 7 and 18 (OD-114; contract rows `list`, `change`, `pickerError`, `reasonMissing`
// of the flags board): the super admin lists only the flags declared in code, each with its
// default, mode, selected clinics, reason and who changed it last and when; sets a flag off for
// all, on for all or on for selected clinics with a reason; a selection is kept but ignored while
// the flag is on or off for all. One audit row `flag.changed` per change (key, before and after
// mode, number of clinics), never the reason.
import { randomUUID } from 'node:crypto';
import { ErrorEnvelope, FlagList, FlagView } from '@shifa/contracts';
import { auditEvent } from '@shifa/db';
import { superuserDb, syntheticPhones, workerDatabaseName } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_FLAGS } from '../access/gated-probe.ts';
import { put } from '../entitlements/support.ts';
import { get, testClock } from '../identity/support.ts';
import {
  CLINIC_NAME,
  createClinicViaApi,
  platformApp,
  resetDatabase,
  type SignedInAdmin,
  signedInAdmin,
} from '../platform/support.ts';
import type { TestApp } from '../support.ts';

const phones = syntheticPhones(2026_12_23, 4);
const REASON = 'تشغيل الطابور الجديد لعيادتين تجريبيتين';

let app: TestApp;
let clock: FixedClock;
let admin: SignedInAdmin;
let clinicId: string;
let secondId: string;

beforeAll(async () => {
  await resetDatabase();
  clock = testClock();
  app = await platformApp(clock, { flags: TEST_FLAGS });
  admin = await signedInAdmin(app, clock, phones[0] ?? '');
  clinicId = (await createClinicViaApi(app, admin.cookie, phones[1] ?? '')).clinicId;
  secondId = (await createClinicViaApi(app, admin.cookie, phones[2] ?? '')).clinicId;
});

afterAll(async () => {
  await app.app.close();
});

const list = () => get(app, '/platform/flags', admin.cookie);
const set = (key: string, body: unknown) => put(app, `/platform/flags/${key}`, body, admin.cookie);
const flagOf = async (key: string) =>
  FlagList.parse((await list()).json()).flags.find((f) => f.key === key);

function issues(res: { json(): unknown }) {
  return ErrorEnvelope.parse(res.json()).error.details;
}

function flagAuditRows() {
  return superuserDb(workerDatabaseName())
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.event, 'flag.changed'))
    .orderBy(auditEvent.at);
}

describe('GET /platform/flags (criterion 7, row `list`)', () => {
  it('lists the flags in code with their default and no change yet', async () => {
    const res = await list();
    expect(res.statusCode, res.body).toBe(200);
    expect(FlagList.parse(res.json())).toEqual({
      flags: [
        {
          key: 'test.flag_on',
          description: 'test-only flag, on by default',
          defaultValue: true,
          mode: 'on',
          clinics: [],
          reason: null,
          updatedByName: null,
          updatedAt: null,
        },
        {
          key: 'test.flag_off',
          description: 'test-only flag, off by default',
          defaultValue: false,
          mode: 'off',
          clinics: [],
          reason: null,
          updatedByName: null,
          updatedAt: null,
        },
      ],
    });
  });
});

describe('PUT /platform/flags/:key (criteria 7, 18, row `change`)', () => {
  it('on for selected clinics: the flag with its clinics, reason and who changed it', async () => {
    const res = await set('test.flag_off', {
      mode: 'selected',
      clinicIds: [clinicId, secondId],
      reason: REASON,
    });
    expect(res.statusCode, res.body).toBe(200);
    const flag = FlagView.parse(res.json());
    expect(flag).toMatchObject({
      key: 'test.flag_off',
      mode: 'selected',
      reason: REASON,
      updatedByName: 'مشرف تجريبي',
      updatedAt: clock.now().toISOString(),
    });
    expect(flag.clinics.map((c) => c.id).sort()).toEqual([clinicId, secondId].sort());
    expect(flag.clinics[0]?.name).toBe(CLINIC_NAME);
    expect(await flagOf('test.flag_off')).toEqual(flag);
  });

  it('off for all keeps the selection (ignored) and is audited without the reason', async () => {
    const res = await set('test.flag_off', {
      mode: 'off',
      reason: 'إيقاف طارئ بعد خلل في الطابور',
    });
    expect(res.statusCode, res.body).toBe(200);
    const flag = FlagView.parse(res.json());
    expect(flag.mode).toBe('off');
    expect(flag.clinics).toHaveLength(2);

    const rows = await flagAuditRows();
    expect(rows.map((r) => r.data)).toEqual([
      { key: 'test.flag_off', before: 'off', after: 'selected', clinics: '2' },
      { key: 'test.flag_off', before: 'selected', after: 'off', clinics: '2' },
    ]);
    for (const row of rows) {
      expect(row.tenantId).toBeNull();
      expect(row.actorId).toBe(admin.userId);
      expect(JSON.stringify(row.data)).not.toContain('إيقاف');
    }
  });

  it('on for all with a new, empty selection', async () => {
    const res = await set('test.flag_on', { mode: 'on', clinicIds: [], reason: REASON });
    expect(res.statusCode, res.body).toBe(200);
    expect(FlagView.parse(res.json())).toMatchObject({ mode: 'on', clinics: [] });
  });

  it.each([
    [
      'selected without clinics',
      { mode: 'selected', clinicIds: [], reason: REASON },
      'body.clinicIds',
    ],
    ['selected with no clinicIds', { mode: 'selected', reason: REASON }, 'body.clinicIds'],
    [
      'an unknown clinic',
      { mode: 'selected', clinicIds: [randomUUID()], reason: REASON },
      'body.clinicIds',
    ],
    ['a short reason', { mode: 'on', reason: 'قصير' }, 'body.reason'],
    ['no reason', { mode: 'on' }, 'body.reason'],
  ])('400 validation_failed: %s', async (_name, body, path) => {
    const before = await flagAuditRows();
    const res = await set('test.flag_on', body);
    expect(res.statusCode, res.body).toBe(400);
    expect(issues(res)?.map((i) => i.path)).toContain(path);
    expect(await flagAuditRows()).toHaveLength(before.length);
  });

  it('a flag not in code: 404', async () => {
    const res = await set('test.gone', { mode: 'on', reason: REASON });
    expect(res.statusCode).toBe(404);
  });
});
