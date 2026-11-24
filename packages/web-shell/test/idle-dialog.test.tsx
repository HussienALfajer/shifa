// Slice A-01-07 checkpoint 4: the idle warning, the 12-hour notice (improvement f) and sign-out,
// as the owner approved them on 2026-11-24 (prototype `Main`). The dialog opens one minute
// before the idle limit with a countdown from 1:00; «متابعة العمل» re-reads the session and
// closes it; «خروج الآن» signs out; at the limit the page signs out with `reason=idle` (or
// `absolute` when the 12-hour limit came first, which no idle dialog can extend). A sign-out in
// one tab sends the others to sign-in, after they asked the server themselves.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, flush, type Rendered, renderShell } from './render.tsx';
import { type FakeApi, fakeApi, SESSION } from './support.ts';

const CHANNEL = 'shifa-session';
const at = (ms: number) => new Date(Date.now() + ms).toISOString();

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.useRealTimers();
});

/** On the fake clock: a session whose idle limit is two minutes away (setting 2: no offset). */
function idleSoon(): FakeApi {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-11-24T10:00:00Z') });
  return fakeApi({
    ...SESSION,
    idleMinutes: 2,
    idleExpiresAt: at(120_000),
    absoluteExpiresAt: at(12 * 3_600_000),
  });
}

/** The dialog renders in a portal on `body`. */
const dialog = (r: Rendered) => r.container.ownerDocument.querySelector('[role="alertdialog"]');

async function home(fake: FakeApi) {
  shown = await renderShell('clinic', fake, '/');
  expect(shown.router.state.location.pathname).toBe('/');
  return shown;
}

describe('the idle warning', () => {
  it('opens one minute before the idle limit with a countdown from 1:00', async () => {
    const fake = idleSoon();
    const r = await home(fake);
    expect(dialog(r)).toBeNull();
    await vi.advanceTimersByTimeAsync(60_500);
    await flush();
    const open = dialog(r);
    expect(open?.textContent).toContain('هل ما زلت تعمل؟');
    expect(open?.textContent).toContain('01:00');
    // The idle setting less the minute of warning.
    expect(open?.textContent).toContain('لم نرَ نشاطاً منذ');
    await vi.advanceTimersByTimeAsync(5_000);
    await flush();
    expect(dialog(r)?.textContent).toContain('00:55');
  });

  it('«متابعة العمل» re-reads the session and closes the dialog', async () => {
    const fake = idleSoon();
    const r = await home(fake);
    await vi.advanceTimersByTimeAsync(61_000);
    await flush();
    expect(dialog(r)).not.toBeNull();
    fake.session = { ...SESSION, idleMinutes: 2, idleExpiresAt: at(120_000) };
    const before = fake.calls.filter((c) => c === 'GET /api/auth/session').length;
    await click(button(document.body, 'متابعة العمل'));
    await vi.advanceTimersByTimeAsync(1_500);
    await flush();
    expect(fake.calls.filter((c) => c === 'GET /api/auth/session').length).toBeGreaterThan(before);
    expect(dialog(r)).toBeNull();
    expect(fake.calls).not.toContain('POST /api/auth/sign-out');
    expect(r.router.state.location.pathname).toBe('/');
  });

  it('«خروج الآن» signs out and says so on sign-in', async () => {
    const fake = idleSoon();
    const r = await home(fake);
    await vi.advanceTimersByTimeAsync(61_000);
    await flush();
    await click(button(document.body, 'خروج الآن'));
    for (let i = 0; i < 50 && r.router.state.location.pathname !== '/sign-in'; i += 1) {
      await flush(20);
    }
    expect(fake.calls).toContain('POST /api/auth/sign-out');
    expect(r.router.state.location.search).toEqual({ reason: 'signed_out' });
    expect(dialog(r)).toBeNull();
  });

  it('at the idle limit the page signs out with reason idle', async () => {
    const fake = idleSoon();
    const r = await home(fake);
    await vi.advanceTimersByTimeAsync(122_000);
    for (let i = 0; i < 50 && r.router.state.location.pathname !== '/sign-in'; i += 1) {
      await flush(20);
    }
    expect(fake.calls).toContain('POST /api/auth/sign-out');
    expect(r.router.state.location.search).toEqual({ reason: 'idle', minutes: 2 });
  });

  it('the 12-hour limit coming first: no idle dialog, the notice, then reason absolute', async () => {
    const fake = fakeApi({
      ...SESSION,
      idleMinutes: 30,
      idleExpiresAt: at(30 * 60_000),
      absoluteExpiresAt: at(9 * 60_000),
    });
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-11-24T10:00:00Z') });
    fake.session = {
      ...SESSION,
      idleMinutes: 30,
      idleExpiresAt: at(30 * 60_000),
      absoluteExpiresAt: at(9 * 60_000),
    };
    shown = await renderShell('clinic', fake, '/');
    const r = shown;
    await vi.advanceTimersByTimeAsync(2_000);
    await flush();
    // Ten minutes or less before the 12-hour limit: a quiet notice with the time it ends.
    const notice = r.container.querySelector('[data-testid="session-ends"]');
    expect(notice?.textContent).toContain('تنتهي جلستك عند');
    expect(notice?.textContent).toMatch(/\d{2}:\d{2}/);
    await vi.advanceTimersByTimeAsync(8 * 60_000 + 30_000);
    await flush();
    expect(dialog(r)).toBeNull();
    await vi.advanceTimersByTimeAsync(40_000);
    for (let i = 0; i < 50 && r.router.state.location.pathname !== '/sign-in'; i += 1) {
      await flush(20);
    }
    expect(r.router.state.location.search).toEqual({ reason: 'absolute' });
  });

  it('no notice while the 12-hour limit is more than ten minutes away', async () => {
    const fake = fakeApi(SESSION);
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-11-24T10:00:00Z') });
    fake.session = {
      ...SESSION,
      idleExpiresAt: at(15 * 60_000),
      absoluteExpiresAt: at(11 * 60_000),
    };
    shown = await renderShell('clinic', fake, '/');
    await vi.advanceTimersByTimeAsync(2_000);
    await flush();
    expect(shown.container.querySelector('[data-testid="session-ends"]')).toBeNull();
  });
});

describe('sign-out across tabs', () => {
  it('a sign-out tells the other tabs', async () => {
    const fake = fakeApi(SESSION);
    shown = await renderShell('clinic', fake, '/');
    const other = new BroadcastChannel(CHANNEL);
    const heard: unknown[] = [];
    other.addEventListener('message', (event) => heard.push(event.data));
    await click(button(shown.container, 'تسجيل الخروج'));
    for (let i = 0; i < 50 && heard.length === 0; i += 1) await flush(20);
    other.close();
    expect(heard).toContainEqual({ type: 'signed-out', reason: 'signed_out' });
  });

  it('another tab’s sign-out: this tab asks the server, then goes to sign-in with the reason', async () => {
    const fake = fakeApi(SESSION);
    shown = await renderShell('clinic', fake, '/');
    const r = shown;
    fake.endSession('unauthorized');
    const other = new BroadcastChannel(CHANNEL);
    other.postMessage({ type: 'signed-out', reason: 'signed_out' });
    for (let i = 0; i < 50 && r.router.state.location.pathname !== '/sign-in'; i += 1) {
      await flush(20);
    }
    other.close();
    expect(r.router.state.location.pathname).toBe('/sign-in');
    expect(r.router.state.location.search).toEqual({ reason: 'signed_out' });
  });

  it('a message while this session is still valid changes nothing', async () => {
    const fake = fakeApi(SESSION);
    shown = await renderShell('clinic', fake, '/');
    const other = new BroadcastChannel(CHANNEL);
    other.postMessage({ type: 'signed-out', reason: 'signed_out' });
    await flush(100);
    other.close();
    expect(shown.router.state.location.pathname).toBe('/');
    expect(fake.calls).not.toContain('POST /api/auth/sign-out');
  });
});
