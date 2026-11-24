// Slice A-01-06: the shell's client turns a 401 into one session-ended event with its code and
// never retries; a failed sign-in is not a session that ended.
import { describe, expect, it } from 'vitest';
import { createShellClient } from '../src/client.ts';
import { fakeApi, SESSION } from './support.ts';

describe('createShellClient', () => {
  it('emits one session-ended event per 401, with its code, and does not retry', async () => {
    const api = fakeApi(SESSION);
    const shell = createShellClient({ baseUrl: 'http://shell.test/api', fetch: api.fetch });
    const codes: string[] = [];
    const off = shell.onSessionEnded((code) => codes.push(code));
    api.endSession('session_expired');
    const { response } = await shell.api.GET('/me/clinics');
    expect(response.status).toBe(401);
    expect(codes).toEqual(['session_expired']);
    expect(api.calls.filter((c) => c === 'GET /api/me/clinics')).toHaveLength(1);
    off();
    await shell.api.GET('/me/clinics');
    expect(codes).toHaveLength(1);
  });

  it('names a 401 without a readable body `unauthorized`', async () => {
    const shell = createShellClient({
      baseUrl: 'http://shell.test/api',
      fetch: () => Promise.resolve(new Response('nope', { status: 401 })),
    });
    const codes: string[] = [];
    shell.onSessionEnded((code) => codes.push(code));
    await shell.api.GET('/auth/session');
    expect(codes).toEqual(['unauthorized']);
  });

  it('a 401 about the request (wrong current password) is not a session that ended (A-01-09)', async () => {
    const shell = createShellClient({
      baseUrl: 'http://shell.test/api',
      fetch: () =>
        Promise.resolve(
          Response.json(
            { error: { code: 'invalid_credentials', message: 'Invalid phone or password' } },
            { status: 401 },
          ),
        ),
    });
    const codes: string[] = [];
    shell.onSessionEnded((code) => codes.push(code));
    const { response } = await shell.api.POST('/auth/password', {
      body: { currentPassword: 'wrong one 12', newPassword: 'amber window crane 77' },
    });
    expect(response.status).toBe(401);
    expect(codes).toEqual([]);
  });

  it('defaults to the same-origin /api prefix', async () => {
    const seen: string[] = [];
    const shell = createShellClient({
      fetch: (request) => {
        seen.push(new URL(request.url).pathname);
        return Promise.resolve(new Response('{}', { status: 200 }));
      },
      origin: 'https://clinic.test',
    });
    await shell.api.GET('/auth/session');
    expect(seen).toEqual(['/api/auth/session']);
  });
});
