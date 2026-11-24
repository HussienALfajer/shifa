// The session as the shell knows it (slice A-01-06): one TanStack Query entry, `['session']`,
// filled by GET /auth/session. A 401 is an answer (signed out, with the code), not an error, so
// it is never retried; other failures retry twice. Refetched whenever the window regains focus.
import type { Schemas } from '@shifa/api-client-ts';
import { type QueryClient, queryOptions, useQuery } from '@tanstack/react-query';
import type { ShellClient } from './client.ts';

export type SessionView = Schemas['SessionView'];

export type SessionState =
  | { kind: 'signed-in'; session: SessionView }
  | { kind: 'signed-out'; code: string };

export const sessionQueryKey = ['session'] as const;

export class SessionLoadError extends Error {
  override name = 'SessionLoadError';
}

export async function fetchSession(shell: ShellClient): Promise<SessionState> {
  const { data, error, response } = await shell.api.GET('/auth/session');
  if (data) return { kind: 'signed-in', session: data };
  if (response.status === 401) {
    const code = (error as { error?: { code?: string } } | undefined)?.error?.code;
    return { kind: 'signed-out', code: code ?? 'unauthorized' };
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

/** Ends the session on the server (best effort) and forgets everything cached for it. */
export async function signOut(shell: ShellClient, queryClient: QueryClient): Promise<void> {
  try {
    await shell.api.POST('/auth/sign-out');
  } finally {
    queryClient.clear();
  }
}
