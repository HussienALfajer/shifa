// Slice A-01-07 checkpoint 5, security review L2: the remembered phone is forgotten on every
// deliberate sign-out, before its request, whatever the server answers (no answer, a 5xx, a 401
// for a session already ended elsewhere); a 401 on sign-out is "signed out", not the warning
// that the session may still be open; a super admin's phone is never remembered on clinic web.
import { createRandom, generatePhone } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { button, click, field, flush, type Rendered, renderShell, type } from './render.tsx';
import { errorAnswer, type FakeApi, fakeApi, json, SESSION } from './support.ts';

const PHONE = generatePhone(createRandom(2026_11_28), 'SY');
const PASSWORD = 'كلمة-مرور-تجريبية-طويلة';

let shown: Rendered | undefined;
beforeEach(() => {
  localStorage.clear();
});
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

function remember() {
  localStorage.setItem('shifa.signIn.phone', PHONE);
  localStorage.setItem('shifa.signIn.phoneAt', String(Date.now()));
}

async function signOutFromHome(api: FakeApi): Promise<Rendered> {
  shown = await renderShell('clinic', api, '/');
  await flush(20);
  await click(button(shown.container, 'تسجيل الخروج'));
  for (let i = 0; i < 50 && shown.router.state.location.pathname !== '/sign-in'; i += 1) {
    await flush(20);
  }
  return shown;
}

const search = (r: Rendered) => r.router.state.location.search as { reason?: string };

describe('the remembered phone, after the checkpoint 5 security review', () => {
  it('no answer to the sign-out: the phone is forgotten all the same', async () => {
    remember();
    const api = fakeApi(SESSION);
    // The server ended the session; its answer never arrived.
    api.answers['/api/auth/sign-out'] = () => {
      api.session = null;
      throw new TypeError('Failed to fetch');
    };
    const r = await signOutFromHome(api);
    expect(search(r).reason).toBe('sign_out_failed');
    expect(localStorage.getItem('shifa.signIn.phone')).toBeNull();
    expect(field(r.container, 'رقم الهاتف').value).toBe('');
  });

  it('a 5xx on the sign-out: the phone is forgotten all the same', async () => {
    remember();
    const api = fakeApi(SESSION);
    api.answers['/api/auth/sign-out'] = () => {
      api.session = null;
      return errorAnswer(503, 'unavailable');
    };
    const r = await signOutFromHome(api);
    expect(search(r).reason).toBe('sign_out_failed');
    expect(localStorage.getItem('shifa.signIn.phone')).toBeNull();
  });

  it('a 401 on the sign-out (ended elsewhere) is signed out, and the phone is forgotten', async () => {
    remember();
    const api = fakeApi(SESSION);
    // Ended elsewhere before the press: the session read and the sign-out both answer 401.
    api.answers['/api/auth/sign-out'] = () => {
      api.session = null;
      return errorAnswer(401, 'unauthorized');
    };
    const r = await signOutFromHome(api);
    await flush(30);
    expect(r.router.state.location.pathname).toBe('/sign-in');
    expect(search(r).reason).not.toBe('sign_out_failed');
    expect(localStorage.getItem('shifa.signIn.phone')).toBeNull();
  });

  it('a super admin signing in on clinic web is not remembered', async () => {
    const api = fakeApi(null);
    api.answers['/api/auth/sign-in'] = () =>
      json(200, { ...SESSION, tenantId: null, platformAdmin: true });
    shown = await renderShell('clinic', api, '/sign-in');
    await type(field(shown.container, 'رقم الهاتف'), PHONE);
    await type(field(shown.container, 'كلمة المرور'), PASSWORD);
    await click(button(shown.container, 'دخول'));
    await flush(20);
    expect(localStorage.getItem('shifa.signIn.phone')).toBeNull();
  });

  it('a clinic person signing in is still remembered', async () => {
    const api = fakeApi(null);
    api.answers['/api/auth/sign-in'] = () => json(200, SESSION);
    shown = await renderShell('clinic', api, '/sign-in');
    await type(field(shown.container, 'رقم الهاتف'), PHONE);
    await type(field(shown.container, 'كلمة المرور'), PASSWORD);
    await click(button(shown.container, 'دخول'));
    await flush(20);
    expect(localStorage.getItem('shifa.signIn.phone')).toBe(PHONE);
  });
});
