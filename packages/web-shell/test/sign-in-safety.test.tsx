// Slice A-01-07 checkpoint 2, security review fixes: the returning connection sends the form only
// soon after the failure and only what the fields hold; one request at a time; the password
// leaves the field when a lock answers; the remembered phone is not kept on admin web, is
// forgotten on a deliberate sign-out and after 14 days; an unreadable phone reads as a wrong one.
import { createRandom, generatePhone } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { button, click, field, flush, type Rendered, renderShell, type } from './render.tsx';
import { errorAnswer, type FakeApi, fakeApi, json, SESSION } from './support.ts';

const PHONE = generatePhone(createRandom(2026_11_25), 'SY');
const OTHER = generatePhone(createRandom(2026_11_26), 'SY');
const PASSWORD = 'كلمة-مرور-تجريبية-طويلة';

let shown: Rendered | undefined;
beforeEach(() => {
  localStorage.clear();
});
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.useRealTimers();
});

async function open(api: FakeApi, path = '/sign-in', app: 'clinic' | 'admin' = 'clinic') {
  shown = await renderShell(app, api, path);
  return shown;
}

async function fill(r: Rendered, phone = PHONE) {
  await type(field(r.container, 'رقم الهاتف'), phone);
  await type(field(r.container, 'كلمة المرور'), PASSWORD);
}

const offline = (api: FakeApi) => {
  api.answers['/api/auth/sign-in'] = () => {
    throw new TypeError('Failed to fetch');
  };
};

describe('sign-in, after the security review', () => {
  it('the returning connection sends what the fields hold now, not the failed attempt', async () => {
    const api = fakeApi(null);
    offline(api);
    const r = await open(api);
    await fill(r);
    await click(button(r.container, 'دخول'));
    await type(field(r.container, 'رقم الهاتف'), OTHER);
    api.answers['/api/auth/sign-in'] = () => json(200, SESSION);
    window.dispatchEvent(new Event('online'));
    await flush(30);
    expect(api.bodies['/api/auth/sign-in']?.at(-1)).toEqual({ phone: OTHER, password: PASSWORD });
  });

  it('two minutes after the failure the returning connection sends nothing by itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = fakeApi(null);
    offline(api);
    const r = await open(api);
    await fill(r);
    await click(button(r.container, 'دخول'));
    await vi.advanceTimersByTimeAsync(2 * 60_000 + 1_000);
    window.dispatchEvent(new Event('online'));
    await flush(30);
    expect(api.bodies['/api/auth/sign-in']).toHaveLength(1);
  });

  it('a second press while a request is out sends nothing', async () => {
    const api = fakeApi(null);
    let release: (r: Response) => void = () => undefined;
    api.answers['/api/auth/sign-in'] = () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      });
    const r = await open(api);
    await fill(r);
    const form = r.container.querySelector('form');
    form?.requestSubmit();
    form?.requestSubmit();
    await flush(20);
    expect(api.bodies['/api/auth/sign-in']).toHaveLength(1);
    release(errorAnswer(401, 'invalid_credentials'));
    await flush(20);
  });

  it('a lock clears the password field', async () => {
    const api = fakeApi(null);
    const until = new Date(Date.now() + 15 * 60_000).toISOString();
    api.answers['/api/auth/sign-in'] = () => errorAnswer(429, 'phone_locked', { until });
    const r = await open(api);
    await fill(r);
    await click(button(r.container, 'دخول'));
    await flush(20);
    expect(field(r.container, 'كلمة المرور').value).toBe('');
  });

  it('a lock counts down on the server’s clock, even when this device’s clock is 20 minutes slow', async () => {
    const api = fakeApi(null);
    const server = Date.now() + 20 * 60_000;
    const until = new Date(server + 15 * 60_000).toISOString();
    api.answers['/api/auth/sign-in'] = () => {
      const answer = errorAnswer(429, 'phone_locked', { until });
      answer.headers.set('date', new Date(server).toUTCString());
      return answer;
    };
    const r = await open(api);
    await fill(r);
    await click(button(r.container, 'دخول'));
    await flush(20);
    const lock = r.container.querySelector<HTMLElement>('[data-testid="sign-in-error"]');
    // 15 minutes left, not 35: the device's clock is not the server's.
    expect(lock?.querySelector('[aria-hidden="true"].tabular-nums')?.textContent).toMatch(
      /1[45]:\d\d/,
    );
    // Screen readers get the end time once, not the ticking countdown.
    expect(lock?.querySelector('.sr-only')?.textContent).toContain('يمكنك المحاولة بعد الساعة');
  });

  it('a phone the server cannot read gets the one wrong-phone-or-password message', async () => {
    const api = fakeApi(null);
    api.answers['/api/auth/sign-in'] = () => errorAnswer(400, 'validation_failed');
    const r = await open(api);
    await fill(r);
    await click(button(r.container, 'دخول'));
    await flush(20);
    expect(r.container.textContent).toContain('رقم الهاتف أو كلمة المرور غير صحيحة');
    expect(r.container.querySelector('[data-testid="sign-in-error"]')).toBeNull();
  });

  it('a 5xx says the server failed, not that the connection is down', async () => {
    const api = fakeApi(null);
    api.answers['/api/auth/sign-in'] = () => errorAnswer(500, 'internal_error');
    const r = await open(api);
    await fill(r);
    await click(button(r.container, 'دخول'));
    await flush(20);
    const box = r.container.querySelector('[data-testid="sign-in-error"]');
    expect(box?.textContent).toContain('حدث خطأ في الخادم');
    expect(box?.textContent).not.toContain('حين يعود الاتصال');
  });

  it('admin web never remembers the phone', async () => {
    const api = fakeApi(null);
    api.answers['/api/auth/sign-in'] = () => json(200, { ...SESSION, platformAdmin: true });
    const r = await open(api, '/sign-in', 'admin');
    await fill(r);
    await click(button(r.container, 'دخول'));
    await flush(20);
    expect(localStorage.getItem('shifa.signIn.phone')).toBeNull();
  });

  it('a deliberate sign-out forgets the remembered phone', async () => {
    localStorage.setItem('shifa.signIn.phone', PHONE);
    localStorage.setItem('shifa.signIn.phoneAt', String(Date.now()));
    const r = await open(fakeApi(null), '/sign-in?reason=signed_out');
    expect(field(r.container, 'رقم الهاتف').value).toBe('');
    expect(localStorage.getItem('shifa.signIn.phone')).toBeNull();
  });

  it('a remembered phone older than 14 days is forgotten', async () => {
    localStorage.setItem('shifa.signIn.phone', PHONE);
    localStorage.setItem('shifa.signIn.phoneAt', String(Date.now() - 15 * 24 * 60 * 60_000));
    const r = await open(fakeApi(null));
    expect(field(r.container, 'رقم الهاتف').value).toBe('');
    expect(localStorage.getItem('shifa.signIn.phone')).toBeNull();
  });
});
