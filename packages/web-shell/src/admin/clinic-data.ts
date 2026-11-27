// Reads of the clinic page tabs (slice A-02-08; A-02 screen contract, admin web rows):
// entitlements, a key's override history, the type preview, settings, support grants and usage,
// keyed `['platform', 'clinic', id, …]` so the router drops them with the clinic's own read. Never
// retried or refetched by themselves (every request is activity to the server). Also the words
// of keys and sources, and the dates these screens show.
import type { Schemas } from '@shifa/api-client-ts';
import type { CommonKey } from '@shifa/i18n';
import { useQuery } from '@tanstack/react-query';
import { clockTime } from '../auth/dates.ts';
import { useShell } from '../providers.tsx';

export type Entitlements = Schemas['ClinicEntitlements'];
export type EntitlementItem = Schemas['EntitlementItem'];
export type OverrideEvent = Schemas['OverrideEvent'];
export type TypePreview = Schemas['TypePreview'];
export type SettingView = Schemas['SettingView'];
export type SupportGrants = Schemas['PlatformSupportGrants'];
export type SupportGrant = Schemas['SupportGrantView'];
export type ClinicUsage = Schemas['ClinicUsage'];

const QUIET = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  staleTime: 0,
} as const;

export const entitlementsKey = (id: string) => ['platform', 'clinic', id, 'entitlements'] as const;
export const settingsKey = (id: string) => ['platform', 'clinic', id, 'settings'] as const;
export const supportKey = (id: string) => ['platform', 'clinic', id, 'support'] as const;
export const usageKey = (id: string) => ['platform', 'clinic', id, 'usage'] as const;

/** A read that answers null for 404 (the clinic or key is gone) and throws otherwise. */
function orNull<T>(data: T | undefined, response: Response, what: string): T | null {
  if (data !== undefined) return data;
  if (response.status === 404) return null;
  throw new Error(`${what} failed`);
}

export function useEntitlements(id: string) {
  const { shell } = useShell();
  return useQuery({
    queryKey: entitlementsKey(id),
    queryFn: async () => {
      const { data, response } = await shell.api.GET('/platform/clinics/{id}/entitlements', {
        params: { path: { id } },
      });
      return orNull(data, response, 'GET entitlements');
    },
    ...QUIET,
  });
}

export function useOverrideHistory(id: string, key: string | null) {
  const { shell } = useShell();
  return useQuery({
    queryKey: ['platform', 'clinic', id, 'history', key],
    enabled: key !== null,
    queryFn: async () => {
      const { data, response } = await shell.api.GET(
        '/platform/clinics/{id}/overrides/{key}/history',
        { params: { path: { id, key: key ?? '' } } },
      );
      return orNull(data, response, 'GET history');
    },
    ...QUIET,
  });
}

export function useTypePreview(id: string, type: Schemas['ClinicType'] | null) {
  const { shell } = useShell();
  return useQuery({
    queryKey: ['platform', 'clinic', id, 'type-preview', type],
    enabled: type !== null,
    queryFn: async () => {
      const { data } = await shell.api.GET('/platform/clinics/{id}/type-preview', {
        params: { path: { id }, query: { type: type ?? 'solo' } },
      });
      if (!data) throw new Error('GET type-preview failed');
      return data;
    },
    ...QUIET,
  });
}

export function useClinicSettings(id: string) {
  const { shell } = useShell();
  return useQuery({
    queryKey: settingsKey(id),
    queryFn: async () => {
      const { data, response } = await shell.api.GET('/platform/clinics/{id}/settings', {
        params: { path: { id } },
      });
      return orNull(data, response, 'GET settings');
    },
    ...QUIET,
  });
}

export function useSupportGrants(id: string) {
  const { shell } = useShell();
  return useQuery({
    queryKey: supportKey(id),
    queryFn: async () => {
      const { data, response } = await shell.api.GET('/platform/clinics/{id}/support-grants', {
        params: { path: { id } },
      });
      return orNull(data, response, 'GET support-grants');
    },
    ...QUIET,
  });
}

export function useUsage(id: string) {
  const { shell } = useShell();
  return useQuery({
    queryKey: usageKey(id),
    queryFn: async () => {
      const { data, response } = await shell.api.GET('/platform/clinics/{id}/usage', {
        params: { path: { id } },
      });
      return orNull(data, response, 'GET usage');
    },
    ...QUIET,
  });
}

/** The words of the catalogue keys the API sends (contract: labels come from i18n by key). */
const KEY_WORD: Record<string, CommonKey> = {
  'limits.practitioners': 'limitPractitioners',
  'limits.branches': 'limitBranches',
  'limits.custom_fields': 'limitCustomFields',
  'session.idle_minutes': 'settingIdle',
};

/** The word of a key, or the key itself for one this client does not know yet. */
export function keyWord(text: (key: CommonKey) => string, key: string): string {
  const word = KEY_WORD[key];
  return word === undefined ? key : text(word);
}

/** Where a setting's value comes from, in words (the super admin's lock is «من: الإدارة»). */
export function sourceWord(setting: SettingView): CommonKey {
  if (setting.source === 'organization') {
    return setting.lockedBy === 'organization' ? 'sourceAdmin' : 'sourceClinic';
  }
  const words = {
    default: 'sourceDefault',
    platform: 'sourcePlatform',
    plan: 'sourcePlan',
    specialty_pack: 'sourcePack',
    branch: 'sourceBranch',
    practitioner: 'sourcePractitioner',
    user: 'sourceUser',
  } as const satisfies Record<Exclude<SettingView['source'], 'organization'>, CommonKey>;
  return words[setting.source];
}

/** Today's Damascus date, `YYYY-MM-DD` (an override's expiry must be after it). */
export function damascusToday(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(now);
}

/** The day after a `YYYY-MM-DD` date. */
export function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10);
}

/** «اليوم 10:42», «أمس 18:05», «قبل 6 أيام», «لا نشاط بعد» (the device's clock). */
export function activityText(
  text: (key: CommonKey, values?: Record<string, unknown>) => string,
  at: string | null | undefined,
  now = Date.now(),
): string {
  if (at === null || at === undefined) return text('activityNone');
  const when = Date.parse(at);
  const days = daysAgo(when, now);
  if (days <= 0) return text('activityToday', { time: clockTime(when) });
  if (days === 1) return text('activityYesterday', { time: clockTime(when) });
  return text('activityDaysAgo', { count: days });
}

/** Whole local days from `at` to `now` (0 today, 1 yesterday). */
export function daysAgo(at: number, now = Date.now()): number {
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.round((day(now) - day(at)) / 86_400_000);
}
