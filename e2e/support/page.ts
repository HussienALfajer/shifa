// Helpers that act as the page itself: every API call is a `fetch` run in the page, so the
// request is same-origin (the API's request guard, A-01-02) and the session cookie lands in the
// browser's own jar.
import type { Page } from '@playwright/test';
import type { SessionView } from '@shifa/contracts';
import pg from 'pg';
import { urls } from './run.ts';

export interface Answer {
  status: number;
  body: unknown;
}

/** Any API call from the page; the body (never logged) is returned to the journey. */
export async function callInPage(
  page: Page,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<Answer> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const res = await fetch(`/api${path}`, {
        method,
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await res.text();
      return { status: res.status, body: text ? (JSON.parse(text) as unknown) : null };
    },
    { method, path, body },
  );
}

/** The body of a call that must succeed with `status`; only the status is told on failure. */
export async function expectCall<T>(
  page: Page,
  status: number,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const answer = await callInPage(page, method, path, body);
  if (answer.status !== status) {
    const code = (answer.body as { error?: { code?: string } } | null)?.error?.code ?? '';
    throw new Error(`${method} ${path} answered ${String(answer.status)} ${code}`);
  }
  return answer.body as T;
}

const postInPage = (page: Page, path: string, body: unknown) =>
  callInPage(page, 'POST', path, body);

function expectSession(answer: Answer, what: string): SessionView {
  // Never the body: it could carry a token on another route.
  if (answer.status !== 200) throw new Error(`${what} answered ${String(answer.status)}`);
  return answer.body as SessionView;
}

/** Sets the password through a setup link (which also signs the person in). */
export async function consumeSetupLink(
  page: Page,
  token: string,
  password: string,
): Promise<SessionView> {
  const answer = await postInPage(page, '/auth/setup-link/consume', { token, password });
  return expectSession(answer, 'setup-link consume');
}

/** Signs in with phone and password from the page. */
export async function signInInPage(
  page: Page,
  phone: string,
  password: string,
): Promise<SessionView> {
  return expectSession(await postInPage(page, '/auth/sign-in', { phone, password }), 'sign-in');
}

/** The page's current session. */
export async function sessionOf(page: Page): Promise<SessionView> {
  const answer = await page.evaluate(async () => {
    const res = await fetch('/api/auth/session');
    return { status: res.status, body: (await res.json()) as unknown };
  });
  return expectSession(answer, 'GET /auth/session');
}

/**
 * Moves a session's last activity two hours back, past every idle limit: the next request ends
 * it with 401 `session_expired`, as an idle session ends on its own.
 */
export async function expireSession(sessionId: string): Promise<void> {
  const client = new pg.Client({ connectionString: urls().database });
  await client.connect();
  try {
    const result = await client.query(
      `UPDATE "session" SET last_active_at = now() - interval '2 hours' WHERE id = $1`,
      [sessionId],
    );
    if (result.rowCount !== 1) throw new Error('the session to expire was not found');
  } finally {
    await client.end();
  }
}
