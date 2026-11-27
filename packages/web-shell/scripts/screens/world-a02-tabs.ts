// What admin web's clinic page tabs read (A-02-08), per clinic: the overrides of the plan's limits
// and their history, the use of each limit, the settings with their source and lock, the support
// grants and 30 days of usage. Synthetic only (names from @shifa/testing), typed from the
// contracts so a contract change breaks the canvas build. The plan values are the seeded plans of
// the API (migration a02_entitlement_policies).
import type {
  ClinicDetail,
  ClinicUsage,
  EntitlementOverride,
  OverrideEvent,
  SettingView,
  SupportGrantView,
} from '@shifa/contracts';
import { createRandom, fullName, generatePersonName } from '@shifa/testing';
import { ago } from './world.ts';
import {
  ACTIVE_CLINIC,
  ACTIVE_OWNER,
  ADMIN_NAME,
  dayFromToday,
  EXPIRED_CLINIC,
  NO_OWNER_CLINIC,
  PENDING_CLINIC,
  SUSPENDED_CLINIC_ID,
  TRIAL_CLINIC,
} from './world-admin.ts';

const random = createRandom(2026_11_28);
/** Another super admin of the platform (an earlier override and support grant). */
export const OTHER_ADMIN = fullName(
  generatePersonName(random, { sex: 'male', adult: true, region: 'aleppo' }),
);

/** A support grant's id (a valid UUID of its own series). */
export const grantId = (n: number) =>
  `6d2a4c1e-4a43-4f0e-9f61-3c3b1f6f0d${String(n).padStart(2, '0')}`;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const LIMIT_KEYS = ['limits.practitioners', 'limits.branches', 'limits.custom_fields'];

export type ClinicType = ClinicDetail['type'];

/** The seeded plans: each type's value of each limit. */
export const PLANS: Record<ClinicType, Record<string, number>> = {
  solo: { 'limits.practitioners': 1, 'limits.branches': 1, 'limits.custom_fields': 20 },
  multi_doctor: { 'limits.practitioners': 10, 'limits.branches': 1, 'limits.custom_fields': 20 },
  multi_branch: { 'limits.practitioners': 30, 'limits.branches': 5, 'limits.custom_fields': 20 },
};

/** One clinic's tabs. */
export interface ClinicTabs {
  overrides: Record<string, EntitlementOverride>;
  /** Each limit's use now; null while the key is not counted (custom fields until A-03). */
  used: Record<string, number | null>;
  /** Each key's history, newest first. */
  history: Record<string, OverrideEvent[]>;
  settings: SettingView[];
  /** Every grant, newest first. */
  grants: SupportGrantView[];
  usage: ClinicUsage;
}

export interface TabsWorld {
  clinics: Record<string, ClinicTabs>;
}

/** The idle setting as the cascade resolves it for a clinic that never set it. */
export const idleSetting = (over: Partial<SettingView> = {}): SettingView => ({
  key: 'session.idle_minutes',
  value: 30,
  source: 'default',
  locked: false,
  lockedBy: null,
  lockable: true,
  choices: [15, 30, 60],
  ...over,
});

/** Today's Damascus date and the 29 before it, oldest first. */
export function damascusDays(count = 30): string[] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(Date.now());
  const [y, m, d] = today.split('-').map(Number);
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) - (count - 1 - i))).toISOString().slice(0, 10),
  );
}

/** 30 days of a clinic: sign-ins and members who signed in each day (Fridays quiet). */
export function usageOf(signIns: readonly number[], over: Partial<ClinicUsage> = {}): ClinicUsage {
  const days = damascusDays();
  const series = days.map((date, i) => {
    const n = signIns[i % signIns.length] ?? 0;
    return { date, signIns: n, membersSignedIn: Math.round(n * 0.6) };
  });
  const last = series.at(-1);
  return {
    today: days.at(-1) ?? '',
    hasData: true,
    todayCounts: {
      signIns: last?.signIns ?? 0,
      membersSignedIn: last?.membersSignedIn ?? 0,
      activeMembers: 23,
      activeBranches: 3,
    },
    members: 26,
    branches: 3,
    lastActivityAt: ago(40 * 60_000),
    days: series,
    previousTotals: { signIns: 279, membersSignedIn: 168 },
    ...over,
  };
}

/** A clinic with no counter row yet: the usage tab's EmptyState. */
export const noUsage = (): ClinicUsage => ({
  today: damascusDays(1)[0] ?? '',
  hasData: false,
  todayCounts: { signIns: 0, membersSignedIn: 0, activeMembers: 0, activeBranches: 0 },
  members: 1,
  branches: 1,
  lastActivityAt: null,
  days: damascusDays().map((date) => ({ date, signIns: 0, membersSignedIn: 0 })),
  previousTotals: { signIns: 0, membersSignedIn: 0 },
});

/** The busy clinic's sign-ins: quiet Fridays, a busier last week. */
const BUSY = [6, 9, 11, 0, 0, 12, 14, 10, 13, 8, 0, 7, 15, 16, 12, 11, 9, 0, 13, 18, 21, 17, 14];
const BUSY_END = [0, 0, 12, 15, 19, 16, 14];

function plain(usage: ClinicUsage, used: Record<string, number | null>): ClinicTabs {
  return { overrides: {}, used, history: {}, settings: [idleSetting()], grants: [], usage };
}

/** The active multi-branch clinic: every case the tabs draw. */
function activeClinic(): ClinicTabs {
  const until = dayFromToday(35);
  return {
    overrides: {
      'limits.practitioners': {
        value: 35,
        reason: 'توسعة قسم الأطفال',
        expiresAt: until,
        expired: false,
        setByName: ADMIN_NAME,
        setAt: ago(6 * DAY),
      },
      'limits.custom_fields': {
        value: 30,
        reason: 'تجربة نموذج الأسنان',
        expiresAt: dayFromToday(-26),
        expired: true,
        setByName: OTHER_ADMIN,
        setAt: ago(56 * DAY),
      },
    },
    used: { 'limits.practitioners': 22, 'limits.branches': 3, 'limits.custom_fields': null },
    history: {
      'limits.practitioners': [
        {
          kind: 'changed',
          at: ago(6 * DAY),
          byName: ADMIN_NAME,
          before: { value: 32, expiresAt: null },
          after: { value: 35, expiresAt: until },
          reason: 'توسعة قسم الأطفال',
        },
        {
          kind: 'set',
          at: ago(55 * DAY),
          byName: OTHER_ADMIN,
          before: null,
          after: { value: 32, expiresAt: null },
          reason: 'افتتاح العيادة المسائية',
        },
        {
          kind: 'type_changed',
          at: ago(58 * DAY),
          byName: ADMIN_NAME,
          before: { value: 10, expiresAt: null },
          after: { value: 30, expiresAt: null },
          reason: null,
        },
      ],
      'limits.custom_fields': [
        {
          kind: 'expired',
          at: ago(25 * DAY),
          byName: null,
          before: { value: 30, expiresAt: dayFromToday(-26) },
          after: null,
          reason: null,
        },
        {
          kind: 'set',
          at: ago(56 * DAY),
          byName: OTHER_ADMIN,
          before: null,
          after: { value: 30, expiresAt: dayFromToday(-26) },
          reason: 'تجربة نموذج الأسنان',
        },
      ],
    },
    settings: [idleSetting()],
    grants: [
      {
        id: grantId(1),
        adminName: OTHER_ADMIN,
        reason:
          'المالك لا يرى موعدًا حجزه السكرتير صباح الأحد في فرع الجميلية، بينما يظهر الموعد في شاشة السكرتير ولا يظهر في تقويم الطبيب.',
        startedAt: ago(3 * DAY),
        expiresAt: ago(3 * DAY - HOUR),
        endedAt: ago(3 * DAY - HOUR),
        endedBy: 'expiry',
        endedByName: null,
      },
      {
        id: grantId(2),
        adminName: ADMIN_NAME,
        reason: 'مراجعة إعداد الفروع بعد النقل',
        startedAt: ago(9 * DAY),
        expiresAt: ago(9 * DAY - HOUR),
        endedAt: ago(9 * DAY - 29 * 60_000),
        endedBy: 'owner',
        endedByName: ACTIVE_OWNER.full,
      },
    ],
    usage: usageOf([...BUSY, ...BUSY_END]),
  };
}

export function tabsWorld(): TabsWorld {
  return {
    clinics: {
      [ACTIVE_CLINIC]: activeClinic(),
      [TRIAL_CLINIC]: plain(
        usageOf([0, 2, 3, 1, 0, 4, 2], {
          lastActivityAt: ago(DAY + 3 * HOUR),
          members: 3,
          branches: 1,
          todayCounts: { signIns: 0, membersSignedIn: 0, activeMembers: 2, activeBranches: 1 },
          previousTotals: { signIns: 0, membersSignedIn: 0 },
        }),
        { 'limits.practitioners': 1, 'limits.branches': 1, 'limits.custom_fields': null },
      ),
      [PENDING_CLINIC]: plain(noUsage(), {
        'limits.practitioners': 1,
        'limits.branches': 1,
        'limits.custom_fields': null,
      }),
      [EXPIRED_CLINIC]: plain(noUsage(), {
        'limits.practitioners': 0,
        'limits.branches': 1,
        'limits.custom_fields': null,
      }),
      [SUSPENDED_CLINIC_ID]: plain(
        usageOf([0], { lastActivityAt: ago(23 * DAY), todayCounts: zero() }),
        { 'limits.practitioners': 6, 'limits.branches': 1, 'limits.custom_fields': null },
      ),
      [NO_OWNER_CLINIC]: plain(
        usageOf(
          [
            0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0,
          ],
          {
            lastActivityAt: ago(9 * DAY),
            todayCounts: zero(),
          },
        ),
        { 'limits.practitioners': 1, 'limits.branches': 1, 'limits.custom_fields': null },
      ),
    },
  };
}

function zero() {
  return { signIns: 0, membersSignedIn: 0, activeMembers: 0, activeBranches: 0 };
}

/** A clinic's tabs, made on first read for one created in Play. */
export function tabsOf(world: { tabs: TabsWorld }, clinicId: string): ClinicTabs {
  world.tabs.clinics[clinicId] ??= plain(noUsage(), {
    'limits.practitioners': 0,
    'limits.branches': 1,
    'limits.custom_fields': null,
  });
  return world.tabs.clinics[clinicId];
}

/** The sign-ins of the last seven Damascus days, today included (the list's column). */
export const signIns7d = (usage: ClinicUsage) =>
  usage.days.slice(-7).reduce((sum, d) => sum + d.signIns, 0);
