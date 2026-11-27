// The flags' read (slice A-02-09; contract row "Flags · list"): GET /platform/flags, keyed under
// `['platform', …]` like every admin read, never retried or refetched by itself. Also the words
// and badge tones of the modes. A flag's title comes from i18n by its key (contract, "How to read
// and use it"); a flag with no title yet shows its description from code.
import type { Schemas } from '@shifa/api-client-ts';
import type { CommonKey } from '@shifa/i18n';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { ShellClient } from '../../client.ts';
import { useShell } from '../../providers.tsx';

export type Flag = Schemas['FlagView'];
export type FlagMode = Flag['mode'];

export const flagsKey = ['platform', 'flags'] as const;

export function flagsQuery(shell: ShellClient) {
  return queryOptions({
    queryKey: flagsKey,
    queryFn: async (): Promise<Flag[]> => {
      const { data } = await shell.api.GET('/platform/flags');
      if (!data) throw new Error('GET /platform/flags failed');
      return data.flags;
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useFlags() {
  const { shell } = useShell();
  return useQuery(flagsQuery(shell));
}

/** Titles of the flags declared in code, by key. Release 1 declares none yet. */
const FLAG_TITLE: Readonly<Record<string, CommonKey>> = {};

export function flagTitle(flag: Flag, text: (key: CommonKey) => string): string {
  const key = FLAG_TITLE[flag.key];
  return key === undefined ? flag.description : text(key);
}

export const MODE_WORD = {
  off: 'flagModeOff',
  on: 'flagModeOn',
  selected: 'flagModeSelected',
} as const satisfies Record<FlagMode, CommonKey>;

export const MODES: readonly FlagMode[] = ['off', 'on', 'selected'];

/** Off for all is a kill switch once someone set it (danger); off by default stays neutral. */
export function modeTone(flag: Flag): 'danger' | 'neutral' | 'success' | 'info' {
  if (flag.mode === 'on') return 'success';
  if (flag.mode === 'selected') return 'info';
  return flag.updatedAt === null ? 'neutral' : 'danger';
}

/** The contract's reason, 10–500 characters once trimmed. */
export const REASON_MIN = 10;
export const REASON_MAX = 500;
