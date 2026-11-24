// The session as the shell knows it (slice A-01-06): one TanStack Query entry, `['session']`,
// filled by GET /auth/session. A 401 is an answer (signed out, with the code), not an error, so
// it is never retried; other failures retry twice. Refetched whenever the window regains focus.
import type { Schemas } from '@shifa/api-client-ts';
import { type QueryClient, queryOptions, useQuery } from '@tanstack/react-query';
import { forgetRememberedPhone } from './auth/remembered-phone.ts';
import { errorFacts, type ShellClient } from './client.ts';
import type { SignInReason } from './guard.ts';
import { announceSignOut } from './tabs.ts';

export type SessionView = Schemas['SessionView'];

export type SessionState =
  | { kind: 'signed-in'; session: SessionView }
  | { kind: 'signed-out'; code: string; reason?: string };

export const sessionQueryKey = ['session'] as const;

export class SessionLoadError extends Error {
  override name = 'SessionLoadError';
}

export async function fetchSession(shell: ShellClient): Promise<SessionState> {
  const { data, error, response } = await shell.api.GET('/auth/session');
  if (data) return { kind: 'signed-in', session: data };
  if (response.status === 401) {
    const { code, reason } = errorFacts(error);
    return reason === undefined
      ? { kind: 'signed-out', code }
      : { kind: 'signed-out', code, reason };
  }
  throw new SessionLoadError(`GET /auth/session answered ${String(response.status)}`);
}

export function sessionQuery(shell: ShellClient) {
  return queryOptions({
    queryKey: sessionQueryKey,
    queryFn: () => fetchSession(shell),
    retry: (failures) => failures < 2,
    // Focus is watched by watchFocus(), which asks again on every focus, not only after a blur.
    refetchOnWindowFocus: false,
    // Every request is activity to the server: no background refetch keeps an unattended
    // session alive (the idle limit counts the person's activity only).
    refetchOnReconnect: false,
    staleTime: 30_000,
  });
}

export function useSession(shell: ShellClient): SessionState | undefined {
  return useQuery(sessionQuery(shell)).data;
}

/**
 * Asks for the session again whenever the page is shown or focused, so a session ended elsewhere
 * shows at once (A-01a criterion 9); the 401 then goes through the client's session-ended rule.
 * Returns the unsubscribe.
 */
export function watchFocus(queryClient: QueryClient): () => void {
  const ask = () => {
    if (document.visibilityState === 'hidden') return;
    void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
  };
  globalThis.addEventListener('focus', ask);
  document.addEventListener('visibilitychange', ask);
  return () => {
    globalThis.removeEventListener('focus', ask);
    document.removeEventListener('visibilitychange', ask);
  };
}

let signOuts = 0;

/**
 * How many sign-outs this page started. A session read that began before one must not write its
 * answer into the cache: the press on «خروج» also fires the activity refresh (review finding 2).
 */
export function signOutCount(): number {
  return signOuts;
}

/**
 * Ends the session on the server and forgets everything cached for it. Never throws: true when
 * the server answered 204 or 401 (already ended), false when the request failed (network, 5xx,
 * another refusal), so the caller can say
 * the session may still be open on the server. With `announce`, the app's other tabs are told
 * (they check with the server before they leave, `tabs.ts`).
 */
export async function signOut(
  shell: ShellClient,
  queryClient: QueryClient,
  announce?: SignInReason,
): Promise<boolean> {
  signOuts += 1;
  // The person is leaving this computer: the remembered phone goes before the request, whatever
  // the answer (checkpoint 5 security review L2).
  if (announce === 'signed_out') forgetRememberedPhone();
  try {
    const { response } = await shell.api.POST('/auth/sign-out');
    // 401: the session had already ended on the server, which is what was asked.
    return response.ok || response.status === 401;
  } catch {
    return false;
  } finally {
    queryClient.clear();
    if (announce !== undefined) announceSignOut(announce);
  }
}
