// Admin web's reads of clinics (slice A-01-10 checkpoint 3): GET /platform/clinics?search= and GET
// /platform/clinics/:id, keyed under `['platform', …]` (a super admin works in no clinic, so the
// router drops them when the person or session changes). Never retried or refetched by themselves:
// every request is activity to the server. Also the words of types and statuses, and days left.
import type { Schemas } from '@shifa/api-client-ts';
import type { CommonKey } from '@shifa/i18n';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { ShellClient } from '../client.ts';
import { useShell } from '../providers.tsx';

export type ClinicSummary = Schemas['ClinicSummary'];
export type ClinicDetail = Schemas['ClinicDetail'];
export type ClinicType = ClinicSummary['type'];
export type ClinicStatus = ClinicSummary['status'];
export type SetupLink = Schemas['SetupLinkIssued'];

const QUIET = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const clinicsKey = (search: string) => ['platform', 'clinics', search] as const;
export const clinicKey = (id: string) => ['platform', 'clinic', id] as const;

export function clinicsQuery(shell: ShellClient, search: string) {
  return queryOptions({
    queryKey: clinicsKey(search),
    queryFn: async (): Promise<ClinicSummary[]> => {
      const { data } = await shell.api.GET('/platform/clinics', {
        params: { query: search === '' ? {} : { search } },
      });
      if (!data) throw new Error('GET /platform/clinics failed');
      return data.clinics;
    },
    staleTime: 30_000,
    ...QUIET,
  });
}

export function useClinics(search: string) {
  const { shell } = useShell();
  return useQuery({ ...clinicsQuery(shell, search), placeholderData: (previous) => previous });
}

/** null: no such clinic (404). */
export function useClinic(id: string) {
  const { shell } = useShell();
  return useQuery({
    queryKey: clinicKey(id),
    queryFn: async (): Promise<ClinicDetail | null> => {
      const { data, response } = await shell.api.GET('/platform/clinics/{id}', {
        params: { path: { id } },
      });
      if (data) return data;
      if (response.status === 404 || response.status === 400) return null;
      throw new Error('GET /platform/clinics/:id failed');
    },
    staleTime: 0,
    ...QUIET,
  });
}

export const TYPE_WORD: Record<ClinicType, CommonKey> = {
  solo: 'clinicTypeSolo',
  multi_doctor: 'clinicTypeMultiDoctor',
  multi_branch: 'clinicTypeMultiBranch',
};

export const STATUS_WORD: Record<ClinicStatus, CommonKey> = {
  trial: 'clinicStatusTrial',
  active: 'clinicStatusActive',
  suspended: 'clinicStatusSuspended',
};

/** Badge tones of the locked status colours: trial info, active success, suspended warning. */
export const STATUS_TONE = {
  trial: 'info',
  active: 'success',
  suspended: 'warning',
} as const satisfies Record<ClinicStatus, string>;

export const STATUSES: readonly ClinicStatus[] = ['trial', 'active', 'suspended'];
export const TYPES: readonly ClinicType[] = ['solo', 'multi_doctor', 'multi_branch'];

/** Whole days from today (the device's) to a `YYYY-MM-DD` date; negative once past. */
export function daysUntil(date: string, now = Date.now()): number {
  const [y, m, d] = date.split('-').map(Number);
  const end = Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
  const today = new Date(now);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end - start) / 86_400_000);
}

/** Improvement g: a subscription that ends within this many days says so. */
export const ENDS_SOON_DAYS = 7;

/** `2026-11-24` → `24/11/2026`. */
export const calendarDate = (date: string) => date.split('-').reverse().join('/');
