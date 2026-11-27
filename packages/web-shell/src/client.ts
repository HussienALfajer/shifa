// The shell's API client (slice A-01-06): the typed client of @shifa/api-client-ts on the app's own
// origin (`/api`, proxied to the API: one origin per app, so the session cookie and the request
// guard's same-origin rule hold), plus one `session-ended` event for every 401 that means the
// session is gone (`unauthorized`, `session_expired`). Nothing retries.
import { type ApiClient, createApiClient } from '@shifa/api-client-ts';
import { rememberSupportEnd, supportEndOf } from './support/state.ts';

/**
 * `reason` is the server's `idle`, `absolute`, `ended` or `support_ended` on a `session_expired`
 * (A-01-09, A-02-10).
 */
export type SessionEndedListener = (code: string, reason?: string) => void;

export interface ShellClient {
  api: ApiClient;
  /** Calls `listener` with the error code of each 401; returns the unsubscribe. */
  onSessionEnded(listener: SessionEndedListener): () => void;
  /** Calls `listener` on each 403 `support_read_only` (a support session's write, A-02-10). */
  onReadOnly(listener: () => void): () => void;
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

/** Why the server ended a session: only these values pass, anything else is dropped. */
const END_REASONS = new Set(['idle', 'absolute', 'ended', 'support_ended']);

export interface ErrorFacts {
  code: string;
  /** Only on `session_expired`: `idle`, `absolute` or `ended`. */
  reason?: string;
  /** Only on a lock: its end, in ms since the epoch. */
  until?: number;
}

/** The facts of an error envelope already parsed (openapi-fetch's `error`); `unauthorized` if none. */
export function errorFacts(body: unknown): ErrorFacts {
  const error = (body as { error?: { code?: unknown; reason?: unknown; until?: unknown } } | null)
    ?.error;
  const code = error?.code;
  if (typeof code !== 'string') return { code: 'unauthorized' };
  const facts: ErrorFacts = { code };
  const { reason, until } = error ?? {};
  if (code === 'session_expired' && typeof reason === 'string' && END_REASONS.has(reason)) {
    facts.reason = reason;
  }
  const end = typeof until === 'string' ? Date.parse(until) : Number.NaN;
  if (Number.isFinite(end)) facts.until = end;
  return facts;
}

/** The same, read from a response whose body nobody read yet. */
async function endOf(response: Response): Promise<ErrorFacts> {
  try {
    return errorFacts(await response.clone().json());
  } catch {
    return { code: 'unauthorized' };
  }
}

export function createShellClient(options: ShellClientOptions = {}): ShellClient {
  const baseUrl = options.baseUrl ?? `${options.origin ?? globalThis.location.origin}/api`;
  const prefix = new URL(baseUrl).pathname.replace(/\/+$/, '');
  const api = createApiClient({ baseUrl, ...(options.fetch ? { fetch: options.fetch } : {}) });
  const listeners = new Set<SessionEndedListener>();
  const readOnly = new Set<() => void>();
  api.use({
    async onResponse({ request, response }) {
      if (response.status === 403) {
        if ((await endOf(response)).code === 'support_read_only') {
          for (const listener of readOnly) listener();
        }
        return undefined;
      }
      if (response.status !== 401) return undefined;
      const path = new URL(request.url).pathname.slice(prefix.length);
      if (NOT_A_SESSION.has(path)) return undefined;
      const { code, reason } = await endOf(response);
      if (!SESSION_CODES.has(code)) return undefined;
      // How a support grant ended, kept for the ended page before anyone is told (A-02-10).
      if (reason === 'support_ended') {
        try {
          const end = supportEndOf(await response.clone().json());
          if (end) rememberSupportEnd(end);
        } catch {
          // No body: the ended page says it plainly.
        }
      }
      for (const listener of listeners) listener(code, reason);
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
    onReadOnly(listener) {
      readOnly.add(listener);
      return () => {
        readOnly.delete(listener);
      };
    },
  };
}
