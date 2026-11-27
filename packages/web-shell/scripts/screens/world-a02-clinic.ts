// What clinic web's A-02 items read (A-02-10): the plan's limits and the subscription, the
// announcements a member has not hidden, the owner's support grants (open ones are the banner,
// all of them the log), the cities and areas a branch may take, and the support session of a super
// admin reading the clinic as its owner. Calm by default (roomy limits, no announcement, no open
// grant), so every sheet that is not about these items looks as it did before A-02. Synthetic
// only (names from @shifa/testing), typed from the contracts so a contract change breaks the build.
import type {
  ClinicCity,
  ClinicSupportGrants,
  MyAnnouncement,
  SessionView,
  SupportGrantView,
} from '@shifa/contracts';
import { createRandom, fullName, generatePersonName } from '@shifa/testing';
import { ago, at, B_MAIN, B_OLD, B_SECOND, CLINIC, ownerSession, profile } from './world.ts';

const random = createRandom(2026_11_29);
const person = (sex: 'male' | 'female') =>
  fullName(generatePersonName(random, { sex, adult: true, region: 'aleppo' }));

/** The super admin who reads the clinic in a support session, and another one. */
export const SUPPORT_ADMIN = person('female');
// Female too: the owner's banner reads «… تقرأ عيادتك» whoever it names (reported, not fixed here).
export const OTHER_SUPPORT_ADMIN = person('female');

/** An id of these items (a valid UUID of its own series). */
export const cid = (n: number) => `5c1f4c1e-4a43-4f0e-9f61-3c3b1f6f0d${String(n).padStart(2, '0')}`;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** `YYYY-MM-DD`, `days` from today in Damascus (the subscription's end). */
export function damascusDay(days: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(Date.now());
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

export const PRACTITIONERS = 'limits.practitioners';
export const BRANCHES = 'limits.branches';
export const CUSTOM_FIELDS = 'limits.custom_fields';

export const ALEPPO = { id: cid(1), name: 'حلب' };
export const AZAZ = { id: cid(2), name: 'أعزاز' };
export const FURQAN = { id: cid(3), name: 'الفرقان' };
export const JAMILIYEH = { id: cid(4), name: 'الجميلية' };
export const SHAHBA = { id: cid(5), name: 'الشهباء' };
export const AZIZIYEH = { id: cid(6), name: 'العزيزية' };
export const SULEIMANIYEH = { id: cid(7), name: 'السليمانية' };
export const KALLASEH = { id: cid(8), name: 'الكلاسة' };

/** What GET /clinic/places answers: Aleppo with its areas (two archived), Azaz with none. */
export function places(): ClinicCity[] {
  return [
    {
      ...ALEPPO,
      archived: false,
      areas: [
        { ...FURQAN, archived: false },
        { ...JAMILIYEH, archived: false },
        { ...SHAHBA, archived: false },
        { ...AZIZIYEH, archived: false },
        { ...SULEIMANIYEH, archived: true },
        { ...KALLASEH, archived: true },
      ],
    },
    { ...AZAZ, archived: false, areas: [] },
  ];
}

/**
 * Each branch's city and area, as its address reads; the archived branch's area was archived
 * since; the third branch (no address either) has no place chosen yet.
 */
export const BRANCH_PLACES: Record<string, { city: typeof ALEPPO; area: typeof ALEPPO | null }> = {
  [B_MAIN.id]: { city: ALEPPO, area: FURQAN },
  [B_SECOND.id]: { city: ALEPPO, area: JAMILIYEH },
  [B_OLD.id]: { city: ALEPPO, area: SULEIMANIYEH },
};

/** The plan's limits: the effective value of each key (the use is counted by the server). */
export interface ClinicA02World {
  limits: Record<string, number>;
  plan: 'solo' | 'multi_doctor' | 'multi_branch';
  status: 'trial' | 'active' | 'suspended';
  subscriptionEnd: string | null;
  features: string[];
  announcements: MyAnnouncement[];
  /** Every support grant on the clinic, newest first; the open ones are the owner's banner. */
  grants: SupportGrantView[];
  places: ClinicCity[];
}

/** Two past grants: one ran out, one the owner ended. */
function pastGrants(): SupportGrantView[] {
  const owner = profile().name;
  return [
    {
      id: cid(21),
      adminName: OTHER_SUPPORT_ADMIN,
      reason:
        'المالك لا يرى موعدًا حجزه السكرتير صباح الأحد في فرع الجميلية، بينما يظهر الموعد في شاشة السكرتير ولا يظهر في تقويم الطبيب.',
      startedAt: ago(3 * DAY),
      expiresAt: ago(3 * DAY - HOUR),
      endedAt: ago(3 * DAY - HOUR),
      endedBy: 'expiry',
      endedByName: null,
    },
    {
      id: cid(22),
      adminName: SUPPORT_ADMIN,
      reason: 'مراجعة إعداد الفروع بعد النقل',
      startedAt: ago(9 * DAY),
      expiresAt: ago(9 * DAY - HOUR),
      endedAt: ago(9 * DAY - 29 * MINUTE),
      endedBy: 'owner',
      endedByName: owner,
    },
  ];
}

export function clinicA02World(): ClinicA02World {
  return {
    limits: { [PRACTITIONERS]: 30, [BRANCHES]: 5, [CUSTOM_FIELDS]: 20 },
    plan: 'multi_branch',
    status: 'active',
    subscriptionEnd: damascusDay(200),
    features: [],
    announcements: [],
    grants: pastGrants(),
    places: places(),
  };
}

export const SUPPORT_REASON = 'مشكلة في الفروع لا تظهر للمالك';

/** An open grant of a super admin, `minutesLeft` before it runs out. */
export function openGrant(
  n: number,
  adminName: string,
  reason: string,
  minutesLeft: number,
): SupportGrantView {
  return {
    id: cid(n),
    adminName,
    reason,
    startedAt: ago((60 - minutesLeft) * MINUTE),
    expiresAt: at(minutesLeft * MINUTE),
    endedAt: null,
    endedBy: null,
    endedByName: null,
  };
}

/** The banner's view of an open grant. */
export const bannerOf = (g: SupportGrantView): ClinicSupportGrants['open'][number] => ({
  id: g.id,
  adminName: g.adminName,
  reason: g.reason,
  expiresAt: g.expiresAt,
});

/** The grant of the support session below. */
export const SUPPORT_GRANT = cid(30);

/** A super admin reading the clinic as its owner (A-02-05: a synthesised owner role). */
export function supportSession(minutesLeft = 42): SessionView {
  return ownerSession({
    userId: cid(31),
    sessionId: cid(32),
    platformAdmin: true,
    branchId: null,
    absoluteExpiresAt: at(minutesLeft * MINUTE),
    support: {
      grantId: SUPPORT_GRANT,
      clinicName: CLINIC,
      reason: SUPPORT_REASON,
      expiresAt: at(minutesLeft * MINUTE),
      now: new Date().toISOString(),
    },
  });
}

/** The announcements the sheets show: a warning and two pieces of information. */
export const ANNOUNCEMENTS = {
  warning: {
    id: cid(41),
    version: 2,
    level: 'warning',
    body: 'صيانة الليلة من 11 إلى 12. احفظوا عملكم قبلها.',
    startsAt: ago(HOUR),
    endsAt: at(10 * HOUR),
  },
  places: {
    id: cid(42),
    version: 1,
    level: 'info',
    body: 'صار بإمكانكم إضافة مدينة الفرع وحيّه من إعدادات الفروع.',
    startsAt: ago(30 * MINUTE),
    endsAt: null,
  },
  training: {
    id: cid(43),
    version: 1,
    level: 'info',
    body: 'تدريب على جدول المواعيد الجديد يوم السبت الساعة 10:00 عبر الهاتف.',
    startsAt: ago(10 * MINUTE),
    endsAt: null,
  },
} as const satisfies Record<string, MyAnnouncement>;
