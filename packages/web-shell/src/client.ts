// The shell's API client (slice A-01-06): the typed client of @shifa/api-client-ts on the app's own
// origin (`/api`, proxied to the API: one origin per app, so the session cookie and the request
// guard's same-origin rule hold), plus one `session-ended` event for every 401 that means the
// session is gone (`unauthorized`, `session_expired`). Nothing retries.
import { type ApiClient, createApiClient } from '@shifa/api-client-ts';

export type SessionEndedListener = (code: string) => void;

export interface ShellClient {
  api: ApiClient;
  /** Calls `listener` with the error code of each 401; returns the unsubscribe. */
  onSessionEnded(listener: SessionEndedListener): () => void;
}

export interface ShellClientOptions {
  /** Defaults to `<origin>/api`. */
  baseUrl?: string;
  /** The page's origin; defaults to `location.origin` (tests pass one). */
  origin?: string;
  fetch?: (request: Request) => Promise<Response>;
}

/** 401s that are an answer about the request, not a session that ended. */
const NOT_A_SESSION = new Set(['/auth/sign-in']);

/**
 * The codes of a 401 that mean the session is gone. Any other 401 code answers the request
 * itself, e.g. `invalid_credentials` for a wrong current password on `/auth/password`
 * (A-01-09): the person stays signed in and the form shows the error.
 */
const SESSION_CODES = new Set(['unauthorized', 'session_expired']);

async function codeOf(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as { error?: { code?: unknown } } | null;
    const code = body?.error?.code;
    return typeof code === 'string' ? code : 'unauthorized';
  } catch {
    return 'unauthorized';
  }
}

export function createShellClient(options: ShellClientOptions = {}): ShellClient {
  const baseUrl = options.baseUrl ?? `${options.origin ?? globalThis.location.origin}/api`;
  const prefix = new URL(baseUrl).pathname.replace(/\/+$/, '');
  const api = createApiClient({ baseUrl, ...(options.fetch ? { fetch: options.fetch } : {}) });
  const listeners = new Set<SessionEndedListener>();
  api.use({
    async onResponse({ request, response }) {
      if (response.status !== 401) return undefined;
      const path = new URL(request.url).pathname.slice(prefix.length);
      if (NOT_A_SESSION.has(path)) return undefined;
      const code = await codeOf(response);
      if (!SESSION_CODES.has(code)) return undefined;
      for (const listener of listeners) listener(code);
      return undefined;
    },
  });
  return {
    api,
    onSessionEnded(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
