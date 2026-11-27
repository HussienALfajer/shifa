// Fixtures of the clinic page tabs (slice A-02-08), as on the approved board `A02Clinic` ("Shifa
// Screens · Admin web", page "Proposals"): a multi-branch clinic with an active override of the
// doctors and an expired one of the custom fields, the idle setting, two past support grants and
// 30 days of usage. Typed from the contracts, so a contract change breaks the fixture. Synthetic.
import type {
  ClinicEntitlements,
  ClinicSettingList,
  ClinicUsage,
  EntitlementItem,
  OverrideHistory,
  PlatformSupportGrants,
  SettingView,
  SupportGrantView,
  TypePreview,
} from '@shifa/contracts';
import { createRandom, fullName, generatePersonName } from '@shifa/testing';
import { ACTIVE, adminApi, detailOf, openAdmin, type Summary } from './admin-support.ts';
import type { FakeApi } from './support.ts';
import { json } from './support.ts';

const random = createRandom(2026_11_29);
const person = () =>
  fullName(generatePersonName(random, { sex: 'female', adult: true, region: 'aleppo' }));
/** The signed-in super admin's name, another super admin's and the clinic owner's. */
export const ADMIN_NAME = person();
export const OTHER_ADMIN = person();
export const OWNER_NAME = person();

export const CLINIC: Summary = { ...ACTIVE, type: 'multi_branch' };
export const base = `/api/platform/clinics/${CLINIC.id}`;

export const DOCTORS: EntitlementItem = {
  key: 'limits.practitioners',
  kind: 'limit',
  planValue: 30,
  override: {
    value: 35,
    reason: 'توسعة قسم الأطفال',
    expiresAt: '2099-12-31',
    expired: false,
    setByName: ADMIN_NAME,
    setAt: '2026-11-20T12:05:00.000Z',
  },
  effective: 35,
  used: 22,
};
export const BRANCHES: EntitlementItem = {
  key: 'limits.branches',
  kind: 'limit',
  planValue: 5,
  override: null,
  effective: 5,
  used: 3,
};
export const FIELDS: EntitlementItem = {
  key: 'limits.custom_fields',
  kind: 'limit',
  planValue: 20,
  override: {
    value: 30,
    reason: 'تجربة نموذج الأسنان',
    expiresAt: '2026-11-01',
    expired: true,
    setByName: OTHER_ADMIN,
    setAt: '2026-10-01T08:00:00.000Z',
  },
  effective: 20,
  used: null,
};
export const ENTITLEMENTS: ClinicEntitlements = {
  plan: 'multi_branch',
  items: [DOCTORS, BRANCHES, FIELDS],
};

export const HISTORY: OverrideHistory = {
  events: [
    {
      kind: 'changed',
      at: '2026-11-20T12:05:00.000Z',
      byName: ADMIN_NAME,
      before: { value: 32, expiresAt: null },
      after: { value: 35, expiresAt: '2099-12-31' },
      reason: 'توسعة قسم الأطفال',
    },
    {
      kind: 'set',
      at: '2026-10-02T07:12:00.000Z',
      byName: OTHER_ADMIN,
      before: null,
      after: { value: 32, expiresAt: null },
      reason: 'افتتاح العيادة المسائية',
    },
    {
      kind: 'type_changed',
      at: '2026-09-15T06:40:00.000Z',
      byName: ADMIN_NAME,
      before: { value: 10, expiresAt: null },
      after: { value: 30, expiresAt: null },
      reason: null,
    },
    {
      kind: 'expired',
      at: '2026-09-01T21:00:00.000Z',
      byName: null,
      before: { value: 12, expiresAt: '2026-09-01' },
      after: null,
      reason: null,
    },
  ],
};

export const PREVIEW_SOLO: TypePreview = {
  type: 'solo',
  limits: [
    { key: 'limits.practitioners', current: 35, next: 35, used: 22, over: false },
    { key: 'limits.branches', current: 5, next: 1, used: 3, over: true },
    { key: 'limits.custom_fields', current: 20, next: 20, used: 0, over: false },
  ],
};

export const IDLE: SettingView = {
  key: 'session.idle_minutes',
  value: 30,
  source: 'default',
  locked: false,
  lockedBy: null,
  lockable: true,
  choices: [15, 30, 60],
};
export const IDLE_LOCKED: SettingView = {
  ...IDLE,
  value: 60,
  source: 'organization',
  locked: true,
  lockedBy: 'organization',
};
export const SETTINGS: ClinicSettingList = { settings: [IDLE] };

export const NOW = '2026-11-26T11:30:00.000Z';
const PAST: SupportGrantView[] = [
  {
    id: '7a1f4c1e-4a43-4f0e-9f61-3c3b1f6f0e01',
    adminName: OTHER_ADMIN,
    reason:
      'المالك لا يرى موعدًا حجزه السكرتير صباح الأحد في فرع الجميلية، بينما يظهر الموعد في شاشة السكرتير ولا يظهر في تقويم الطبيب.',
    startedAt: '2026-11-24T07:10:00.000Z',
    expiresAt: '2026-11-24T08:10:00.000Z',
    endedAt: '2026-11-24T08:10:00.000Z',
    endedBy: 'expiry',
    endedByName: null,
  },
  {
    id: '7a1f4c1e-4a43-4f0e-9f61-3c3b1f6f0e02',
    adminName: ADMIN_NAME,
    reason: 'مراجعة إعداد الفروع بعد النقل',
    startedAt: '2026-11-18T14:02:00.000Z',
    expiresAt: '2026-11-18T15:02:00.000Z',
    endedAt: '2026-11-18T14:31:00.000Z',
    endedBy: 'owner',
    endedByName: OWNER_NAME,
  },
];
export const MINE: SupportGrantView = {
  id: '7a1f4c1e-4a43-4f0e-9f61-3c3b1f6f0e03',
  adminName: ADMIN_NAME,
  reason: 'مشكلة في الفروع لا تظهر للمالك',
  startedAt: '2026-11-26T11:12:00.000Z',
  expiresAt: '2026-11-26T12:12:00.000Z',
  endedAt: null,
  endedBy: null,
  endedByName: null,
};
export const GRANTS: PlatformSupportGrants = { now: NOW, mine: null, grants: PAST };
export const GRANTS_OPEN: PlatformSupportGrants = { now: NOW, mine: MINE, grants: [MINE, ...PAST] };
export const HANDOFF = 'http://localhost:5173/support#U3ludGhldGljLWhhbmRvZmYtdG9rZW4tMDAwMDAwMDAx';

const SIGNINS = [6, 9, 11, 0, 0, 12, 14, 10, 13, 8, 0, 7, 15, 16, 12, 11, 9, 0, 13, 18, 21, 17, 14];
const MORE = [0, 0, 12, 15, 19, 16, 14];
const MEMBERS = [4, 6, 7, 0, 0, 8, 9, 7, 8, 6, 0, 5, 9, 10, 8, 7, 6, 0, 8, 10, 11, 10, 9];
const MEMBERS_MORE = [0, 0, 8, 9, 11, 11, 9];
const all = [...SIGNINS, ...MORE];
const members = [...MEMBERS, ...MEMBERS_MORE];
const day = (i: number) => {
  const d = new Date(Date.UTC(2026, 9, 28 + i));
  return d.toISOString().slice(0, 10);
};
export const USAGE: ClinicUsage = {
  today: '2026-11-26',
  hasData: true,
  todayCounts: { signIns: 14, membersSignedIn: 9, activeMembers: 23, activeBranches: 3 },
  members: 26,
  branches: 3,
  lastActivityAt: NOW,
  days: all.map((n, i) => ({ date: day(i), signIns: n, membersSignedIn: members[i] ?? 0 })),
  previousTotals: { signIns: 279, membersSignedIn: 0 },
};

export interface TabsApi extends FakeApi {
  /** The full URL of every request, query included (the fake's answers see paths only). */
  urls: string[];
}

/** The super admin's fake API with the clinic and every tab's answers. */
export function tabsApi(): TabsApi {
  const fake = adminApi([CLINIC]) as TabsApi;
  fake.urls = [];
  const inner = fake.fetch;
  fake.fetch = (request) => {
    fake.urls.push(
      `${request.method} ${new URL(request.url).pathname}${new URL(request.url).search}`,
    );
    return inner(request);
  };
  fake.answers[`${base}/entitlements`] = () => json(200, ENTITLEMENTS);
  fake.answers[`${base}/settings`] = () => json(200, SETTINGS);
  fake.answers[`${base}/support-grants`] = () => json(200, GRANTS);
  fake.answers[`${base}/usage`] = () => json(200, USAGE);
  fake.answers[`${base}/type-preview`] = () => json(200, PREVIEW_SOLO);
  fake.answers[`${base}/overrides/limits.practitioners/history`] = () => json(200, HISTORY);
  return fake;
}

export const detail = () => detailOf(CLINIC);
export const openClinic = (fake: FakeApi) => openAdmin(fake, `/clinics/${CLINIC.id}`);
