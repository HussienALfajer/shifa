// A-01a criterion 14 (identity part): one audit row per sign-in success and failure, phone lock,
// IP block and session end (sign-out, one, all others, idle, absolute, replaced at sign-in).
// Rows carry ids, the event, the request id and an allowlisted reason: never a phone.
import { fixtureId, syntheticPhones } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../support.ts';
import {
  auditRows,
  get,
  identityApp,
  resetWithTenants,
  seedPerson,
  sessionCookie,
  sessionRows,
  setIdleMinutes,
  signIn,
  testClock,
} from './support.ts';

const MINUTE = 60_000;
const TENANT = fixtureId('audit:tenant');
const phones = syntheticPhones(2026_11_14, 40);
const phone = (i: number) => phones[i] ?? '';

let app: TestApp;
let clock: FixedClock;

beforeEach(async () => {
  await resetWithTenants(TENANT);
  clock = testClock();
  app = await identityApp(clock);
});

afterEach(async () => {
  await app.app.close();
});

describe('identity audit rows', () => {
  it('sign-in success: actor = the person, target = the session, request id, null tenant', async () => {
    const person = await seedPerson(phone(0), { tenantId: TENANT, role: 'owner' });
    const res = await signIn(app, phone(0));
    const [session] = await sessionRows(person.userId);
    const rows = await auditRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event: 'auth.sign_in',
      tenantId: null,
      actorId: person.userId,
      targetId: session?.id,
      requestId: res.headers['x-request-id'],
    });
  });

  it('sign-in failure: known person as target, unknown phone with no target; reason only', async () => {
    const person = await seedPerson(phone(1));
    await signIn(app, phone(1), 'wrong password');
    await signIn(app, phone(2), 'wrong password');
    const rows = await auditRows();
    expect(rows.map((r) => [r.event, r.actorId, r.targetId, r.data])).toEqual([
      ['auth.sign_in_failed', null, person.userId, { reason: 'invalid_credentials' }],
      ['auth.sign_in_failed', null, null, { reason: 'invalid_credentials' }],
    ]);
  });

  it('a phone lock writes one auth.locked row (kind phone); refusals while locked write failures', async () => {
    const person = await seedPerson(phone(3));
    for (let i = 0; i < 5; i += 1) await signIn(app, phone(3), 'wrong password');
    await signIn(app, phone(3), 'wrong password');
    const rows = await auditRows();
    const locked = rows.filter((r) => r.event === 'auth.locked');
    expect(locked).toHaveLength(1);
    expect(locked[0]).toMatchObject({ targetId: person.userId, data: { kind: 'phone' } });
    expect(rows.at(-1)).toMatchObject({
      event: 'auth.sign_in_failed',
      data: { reason: 'phone_locked' },
    });
  });

  it('an IP block writes one auth.locked row (kind ip)', async () => {
    for (let i = 0; i < 30; i += 1) {
      await signIn(app, phone(i), 'wrong password', { ip: '192.0.2.90' });
    }
    const locked = (await auditRows()).filter((r) => r.event === 'auth.locked');
    expect(locked.map((r) => r.data)).toEqual([{ kind: 'ip' }]);
  });

  it('session ends: sign-out, one, all others, replaced at sign-in, idle, absolute', async () => {
    // A doctor: owners reach their sessions only after TOTP (A-01-03), not the subject here.
    const person = await seedPerson(phone(4), { tenantId: TENANT, role: 'doctor' });
    await setIdleMinutes(TENANT, 60);
    const a = sessionCookie(await signIn(app, phone(4)));
    await signIn(app, phone(4));
    const c = sessionCookie(await signIn(app, phone(4)));
    // replaced: sign in again presenting c
    await signIn(app, phone(4), undefined, { cookie: c });
    // one: a ends b
    const list = (await get(app, '/auth/sessions', a)).json<{
      sessions: { id: string; current: boolean }[];
    }>();
    const others = list.sessions.filter((s) => !s.current);
    await app.app.inject({
      method: 'DELETE',
      url: `/auth/sessions/${others[0]?.id ?? ''}`,
      headers: { cookie: a },
    });
    // all others: a ends what is left besides itself
    await app.app.inject({
      method: 'POST',
      url: '/auth/sessions/end-others',
      headers: { cookie: a },
    });
    // sign-out: a
    await app.app.inject({ method: 'POST', url: '/auth/sign-out', headers: { cookie: a } });
    // idle and absolute on fresh sessions
    const e = sessionCookie(await signIn(app, phone(4)));
    clock.advanceBy(60 * MINUTE);
    await get(app, '/auth/session', e);
    const f = sessionCookie(await signIn(app, phone(4)));
    for (let i = 0; i < 24; i += 1) {
      clock.advanceBy(30 * MINUTE);
      await get(app, '/auth/session', f);
    }
    const ended = (await auditRows())
      .filter((r) => r.event === 'auth.session_ended')
      .map((r) => (r.data as { reason?: string }).reason);
    expect(ended).toEqual(['replaced', 'ended', 'ended_others', 'sign_out', 'idle', 'absolute']);
    for (const row of (await auditRows()).filter((r) => r.event === 'auth.session_ended')) {
      expect(row.actorId).toBe(person.userId);
      expect(row.targetId).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('no audit row holds a phone, in any spelling', async () => {
    await seedPerson(phone(5));
    await signIn(app, phone(5));
    await signIn(app, phone(5), 'wrong password');
    await signIn(app, phone(6), 'wrong password');
    const text = JSON.stringify(await auditRows());
    for (const p of [phone(5), phone(6)]) {
      expect(text).not.toContain(p);
      expect(text).not.toContain(p.slice(4));
    }
  });
});
