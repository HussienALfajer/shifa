// A fake API for the shell tests: answers GET /auth/session from a mutable state and records
// every request, typed from the contracts so a contract change breaks the fixture.
import type { SessionView } from '@shifa/contracts';

export interface FakeApi {
  fetch: (input: Request) => Promise<Response>;
  /** The session the next GET /auth/session returns; null → 401 with `signedOutCode`. */
  session: SessionView | null;
  signedOutCode: string;
  /** Method and path of every request, in order. */
  calls: string[];
  /** Makes every request after this one answer 401 with this code. */
  endSession(code: string): void;
}

export const SESSION: SessionView = {
  userId: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0a01',
  sessionId: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0a02',
  platformAdmin: false,
  mfa: 'verified',
  mfaRequired: false,
  tenantId: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0a03',
  branchId: null,
  roles: [],
  idleMinutes: 15,
  idleExpiresAt: '2026-11-24T10:15:00.000Z',
  absoluteExpiresAt: '2026-11-24T22:00:00.000Z',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const error = (code: string) => json(401, { error: { code, message: 'Unauthorized' } });

export function fakeApi(session: SessionView | null = null): FakeApi {
  let ended: string | null = null;
  const api: FakeApi = {
    session,
    signedOutCode: 'unauthorized',
    calls: [],
    endSession: (code) => {
      ended = code;
      api.session = null;
      api.signedOutCode = code;
    },
    fetch: (request) => {
      const path = new URL(request.url).pathname;
      api.calls.push(`${request.method} ${path}`);
      if (path === '/api/auth/sign-out') {
        api.session = null;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (ended !== null) return Promise.resolve(error(ended));
      if (path === '/api/auth/session') {
        return Promise.resolve(api.session ? json(200, api.session) : error(api.signedOutCode));
      }
      return Promise.resolve(json(200, { clinics: [] }));
    },
  };
  return api;
}
