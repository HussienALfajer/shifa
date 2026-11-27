// The announcements' read (slice A-02-09; contract row "Announcements · list"): GET
// /platform/announcements?status=, keyed under `['platform', …]`, never retried or refetched by
// itself. The answer carries the count of every status whatever the filter. Also the words and
// tones of levels and statuses, and the date and time of the form's fields.
import type { Schemas } from '@shifa/api-client-ts';
import type { CommonKey } from '@shifa/i18n';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { ShellClient } from '../../client.ts';
import { useShell } from '../../providers.tsx';

export type Announcement = Schemas['Announcement'];
export type AnnouncementStatus = Announcement['status'];
export type AnnouncementLevel = Announcement['level'];

export const announcementsKey = (status: AnnouncementStatus) =>
  ['platform', 'announcements', status] as const;

export function announcementsQuery(shell: ShellClient, status: AnnouncementStatus) {
  return queryOptions({
    queryKey: announcementsKey(status),
    queryFn: async () => {
      const { data } = await shell.api.GET('/platform/announcements', {
        params: { query: { status } },
      });
      if (!data) throw new Error('GET /platform/announcements failed');
      return data;
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useAnnouncements(status: AnnouncementStatus) {
  const { shell } = useShell();
  return useQuery({
    ...announcementsQuery(shell, status),
    placeholderData: (previous) => previous,
  });
}

export const STATUSES: readonly AnnouncementStatus[] = ['scheduled', 'active', 'ended'];

export const FILTER_WORD = {
  scheduled: 'annFilterScheduled',
  active: 'annFilterActive',
  ended: 'annFilterEnded',
} as const satisfies Record<AnnouncementStatus, CommonKey>;

export const NONE_WORDS = {
  scheduled: ['annNoneScheduledTitle', 'annNoneScheduledText'],
  active: ['annNoneActiveTitle', 'annNoneActiveText'],
  ended: ['annNoneEndedTitle', 'annNoneEndedText'],
} as const satisfies Record<AnnouncementStatus, readonly [CommonKey, CommonKey]>;

export const LEVEL_WORD = {
  info: 'annLevelInfo',
  warning: 'annLevelWarning',
} as const satisfies Record<AnnouncementLevel, CommonKey>;

export const LEVEL_TITLE = {
  info: 'annLevelInfoTitle',
  warning: 'annLevelWarningTitle',
} as const satisfies Record<AnnouncementLevel, CommonKey>;

export const BODY_MAX = 280;

const pad = (n: number) => String(n).padStart(2, '0');

/** An ISO instant as the device's `YYYY-MM-DD` and `HH:MM`. */
export function localParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** The device's `YYYY-MM-DD` and `HH:MM` as an ISO instant; null when the date is missing. */
export function instantOf(date: string | null, time: string | null): string | null {
  if (date === null || date === '') return null;
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = (time === null || time === '' ? '00:00' : time).split(':').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0).toISOString();
}
