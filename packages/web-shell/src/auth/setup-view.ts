// What the entry path carries from one screen to the next (slice A-01-07), in the query cache
// only (never browser storage), kept until the session's person changes (the router drops every
// other query then): the person and the clinic of the setup link, for the recovery codes' print
// sheet; the recovery codes left after a recovery-code sign-in, for the notice that follows. The
// token, the password, the key and the codes themselves are never put here.
import type { QueryClient } from '@tanstack/react-query';

export interface SetupPerson {
  personName: string;
  clinicName: string | null;
}

const SETUP_KEY = ['entry', 'setup-person'] as const;
const CODES_LEFT_KEY = ['entry', 'recovery-codes-left'] as const;

function keep(queryClient: QueryClient, key: readonly string[]) {
  // No component observes these entries: without this they would be collected after 5 minutes.
  queryClient.setQueryDefaults(key, { gcTime: Number.POSITIVE_INFINITY, staleTime: 'static' });
}

export function rememberSetupView(queryClient: QueryClient, person: SetupPerson): void {
  keep(queryClient, SETUP_KEY);
  queryClient.setQueryData(SETUP_KEY, person);
}

export function setupPerson(queryClient: QueryClient): SetupPerson | undefined {
  return queryClient.getQueryData<SetupPerson>(SETUP_KEY);
}

export function rememberCodesLeft(queryClient: QueryClient, left: number): void {
  keep(queryClient, CODES_LEFT_KEY);
  queryClient.setQueryData(CODES_LEFT_KEY, left);
}

export function codesLeft(queryClient: QueryClient): number | undefined {
  return queryClient.getQueryData<number>(CODES_LEFT_KEY);
}
