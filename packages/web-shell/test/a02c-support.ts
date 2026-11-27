// Fixtures of clinic web's A-02 screens (slice A-02-10; boards `A02cSettings`,
// `A02cSupportSession`, `A02cAnnouncements`, `A02cLimits`, `A02cBranchPlace` on "Shifa Screens ·
// Clinic web"): a support session's view, the owner's support grants, announcements, what the
// plan allows, the subscription and the places a branch may take. Synthetic names only.
import type { SessionView } from '@shifa/contracts';
import { createRandom, generatePersonName } from '@shifa/testing';
import type { FakeApi } from './support.ts';
import { json } from './support.ts';
import { ID, OWNER_SESSION, TENANT } from './team-support.ts';

const random = createRandom(2026_11_27);
const person = (sex: 'male' | 'female') => {
  const n = generatePersonName(random, { sex, adult: true, region: 'aleppo' });
  return `${n.given} ${n.family}`;
};

export const ADMIN_NAME = person('female');
export const OTHER_ADMIN = person('male');
export const OWNER_NAME = person('male');
export const REASON = 'مشكلة في الفروع لا تظهر للمالك';
export const SUPPORT_CLINIC = 'مجمع النجار الطبي';

export const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

export const GRANT_ID = ID(61);

/** The super admin reading the clinic as its owner (A-02-05: a synthesised owner role). */
export const SUPPORT_SESSION: SessionView = {
  ...OWNER_SESSION,
  userId: ID(62),
  platformAdmin: true,
  branchId: null,
  support: {
    grantId: GRANT_ID,
    clinicName: SUPPORT_CLINIC,
    reason: REASON,
    expiresAt: minutesFromNow(42),
    now: new Date().toISOString(),
  },
};

export const SUPPORT_GRANTS_PATH = '/api/clinic/support-grants';
export const endGrantPath = (id: string) => `/api/clinic/support-grants/${id}/end`;
export const CAPABILITIES_PATH = '/api/clinic/capabilities';
export const SUBSCRIPTION_PATH = '/api/clinic/subscription';
export const ANNOUNCEMENTS_PATH = '/api/me/announcements';
export const dismissPath = (id: string) => `/api/me/announcements/${id}/dismiss`;
export const PLACES_PATH = '/api/clinic/places';

export interface GrantRow {
  id: string;
  adminName: string;
  reason: string;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  endedBy: 'admin' | 'owner' | 'expiry' | null;
  endedByName: string | null;
}

export const OPEN_GRANT: GrantRow = {
  id: GRANT_ID,
  adminName: ADMIN_NAME,
  reason: REASON,
  startedAt: minutesFromNow(-18),
  expiresAt: minutesFromNow(42),
  endedAt: null,
  endedBy: null,
  endedByName: null,
};
export const EXPIRED_GRANT: GrantRow = {
  id: ID(63),
  adminName: OTHER_ADMIN,
  reason: 'المالك لا يرى موعدًا حجزه السكرتير صباح الأحد في فرع الجميلية',
  startedAt: '2026-11-24T07:10:00.000Z',
  expiresAt: '2026-11-24T08:10:00.000Z',
  endedAt: '2026-11-24T08:10:00.000Z',
  endedBy: 'expiry',
  endedByName: null,
};

export const supportGrants = (open: GrantRow[], ended: GrantRow[] = [EXPIRED_GRANT]) => ({
  now: new Date().toISOString(),
  open: open.map(({ id, adminName, reason, expiresAt }) => ({ id, adminName, reason, expiresAt })),
  grants: [...open, ...ended],
});

export interface Limit {
  key: string;
  limit: number;
  used: number | null;
}

export const capabilities = (limits: Limit[]) => ({ entitlements: {}, limits, flags: {} });

export const LIMITS_ROOMY: Limit[] = [
  { key: 'limits.practitioners', limit: 35, used: 22 },
  { key: 'limits.branches', limit: 5, used: 3 },
  { key: 'limits.custom_fields', limit: 20, used: null },
];

export const subscription = (limits: Limit[], subscriptionEnd: string | null) => ({
  plan: 'multi_branch',
  status: 'active',
  subscriptionEnd,
  limits,
  features: [],
});

export interface MyAnnouncementRow {
  id: string;
  version: number;
  level: 'info' | 'warning';
  body: string;
  startsAt: string;
  endsAt: string | null;
}

export const WARNING: MyAnnouncementRow = {
  id: ID(71),
  version: 2,
  level: 'warning',
  body: 'صيانة الليلة من 11 إلى 12. احفظوا عملكم قبلها.',
  startsAt: minutesFromNow(-60),
  endsAt: null,
};
export const INFO_ONE: MyAnnouncementRow = {
  id: ID(72),
  version: 1,
  level: 'info',
  body: 'صار بإمكانكم إضافة مدينة الفرع وحيّه من إعدادات الفروع.',
  startsAt: minutesFromNow(-30),
  endsAt: null,
};
export const INFO_TWO: MyAnnouncementRow = {
  id: ID(73),
  version: 1,
  level: 'info',
  body: 'تدريب على جدول المواعيد الجديد يوم السبت 10:00 عبر الهاتف.',
  startsAt: minutesFromNow(-10),
  endsAt: null,
};

export const ALEPPO = { id: ID(81), name: 'حلب' };
export const AZAZ = { id: ID(82), name: 'أعزاز' };
export const SHAHBA = { id: ID(83), name: 'الشهباء' };
export const JAMILIYEH = { id: ID(84), name: 'الجميلية' };
export const KALLASEH = { id: ID(85), name: 'الكلاسة' };

export const PLACES = {
  cities: [
    {
      ...ALEPPO,
      archived: false,
      areas: [
        { ...JAMILIYEH, archived: false },
        { ...SHAHBA, archived: false },
        { ...KALLASEH, archived: true },
      ],
    },
    { ...AZAZ, archived: false, areas: [] },
  ],
};

/** Adds the A-02 reads every page of clinic web makes, with the given answers. */
export function withA02(
  api: FakeApi,
  options: {
    limits?: Limit[];
    announcements?: MyAnnouncementRow[];
    open?: GrantRow[];
    ended?: GrantRow[];
    subscriptionEnd?: string | null;
  } = {},
): FakeApi {
  const limits = options.limits ?? LIMITS_ROOMY;
  api.answers[CAPABILITIES_PATH] = () => json(200, capabilities(limits));
  api.answers[SUBSCRIPTION_PATH] = () =>
    json(200, subscription(limits, options.subscriptionEnd ?? '2026-12-31'));
  const announcements = [...(options.announcements ?? [])];
  api.answers[ANNOUNCEMENTS_PATH] = () => json(200, { announcements });
  for (const a of announcements) {
    api.answers[dismissPath(a.id)] = () => {
      announcements.splice(announcements.indexOf(a), 1);
      return new Response(null, { status: 204 });
    };
  }
  api.answers[SUPPORT_GRANTS_PATH] = () =>
    json(200, supportGrants(options.open ?? [], options.ended));
  api.answers[PLACES_PATH] = () => json(200, PLACES);
  api.answers['/api/clinic/settings'] = () =>
    json(200, { idleMinutes: 15, source: 'organization', locked: false });
  return api;
}

export { TENANT };

/** Every PageBanner region on the page, by its name. */
export function banner(name: string): HTMLElement | null {
  for (const region of document.body.querySelectorAll<HTMLElement>('[role="region"]')) {
    if (region.getAttribute('aria-label') === name) return region;
  }
  return null;
}

/** The text of the whole document, for words outside the shell's container (dialogs). */
export const pageText = () => document.body.textContent;
