// Slice A-02-10 checkpoint 2: the support session in clinic web, as the owner approved it on
// 2026-11-27 (board `A02cSupportSession`): the hand-off at `/support#<token>` (read from the
// fragment, removed at once, sent in the body only; 404 `link_invalid` → «انتهى دخول الدعم»),
// the clinic read as its owner under the solid support banner with time left and «إنهاء», write
// buttons drawn disabled with «للقراءة فقط», a 403 `support_read_only` named, and the full page
// «انتهى دخول الدعم» after a 401 `support_ended` (expiry, owner) or the tab's own end.
import { afterEach, describe, expect, it } from 'vitest';
import {
  ADMIN_NAME,
  banner,
  dismissPath,
  OWNER_NAME,
  pageText,
  REASON,
  SUPPORT_CLINIC,
  SUPPORT_SESSION,
  WARNING,
  withA02,
} from './a02c-support.ts';
import { button, click, flush, type Rendered, renderShell } from './render.tsx';
import { errorAnswer, type FakeApi, fakeApi, json } from './support.ts';
import { teamApi } from './team-support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const TOKEN = 'Abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE';
const HANDOFF = '/api/auth/support/session';

function supportApi() {
  const api = withA02(teamApi({ session: SUPPORT_SESSION }));
  api.answers['/api/me'] = () =>
    json(200, { userId: SUPPORT_SESSION.userId, name: ADMIN_NAME, phone: '+963900000000' });
  return api;
}

/** From now on every route answers as a support session whose grant ended. */
function endEverything(api: FakeApi, ended: Response) {
  for (const path of [...Object.keys(api.answers), '/api/auth/session']) {
    api.answers[path] = () => ended.clone();
  }
}

async function open(path: string, api = supportApi()) {
  shown = await renderShell('clinic', api, path);
  await flush(60);
  return { api, r: shown };
}

describe('support session: the hand-off', () => {
  it('sends the fragment in the body only, removes it from the address and goes home', async () => {
    const api = withA02(fakeApi(null));
    api.answers[HANDOFF] = () => {
      api.session = SUPPORT_SESSION;
      return json(200, SUPPORT_SESSION);
    };
    const { r } = await open(`/support#${TOKEN}`, api);
    expect(api.bodies[HANDOFF]).toEqual([{ token: TOKEN }]);
    expect(api.calls.some((c) => c.includes(TOKEN))).toBe(false);
    expect(r.router.state.location.hash).toBe('');
    expect(r.router.state.location.pathname).toBe('/');
    expect(banner('دخول الدعم')).not.toBeNull();
  });

  it('answers a used or expired hand-off with «انتهى دخول الدعم»', async () => {
    const api = fakeApi(null);
    api.answers[HANDOFF] = () => errorAnswer(404, 'link_invalid');
    const { r } = await open(`/support#${TOKEN}`, api);
    expect(r.container.textContent).toContain('انتهى دخول الدعم');
    expect(r.container.textContent).toContain('العودة إلى إدارة شفاء');
  });

  it('never asks without a token', async () => {
    const api = fakeApi(null);
    await open('/support', api);
    expect(api.bodies[HANDOFF]).toBeUndefined();
    expect(pageText()).toContain('انتهى دخول الدعم');
  });
});

describe('support session: reading the clinic as its owner', () => {
  it('stays in clinic web (never sent to admin web) under the support banner', async () => {
    const { r } = await open('/team');
    expect(r.router.state.location.pathname).toBe('/team');
    const strip = banner('دخول الدعم');
    expect(strip?.textContent).toContain('دخول الدعم · للقراءة فقط');
    expect(strip?.textContent).toContain(SUPPORT_CLINIC);
    expect(strip?.textContent).toContain(REASON);
    expect(strip?.textContent).toMatch(/متبقٍّ (41|42) دقيقة/);
    expect(strip?.querySelector('button')?.textContent).toBe('إنهاء');
  });

  it('draws the write buttons disabled with «للقراءة فقط»', async () => {
    const { r } = await open('/team');
    expect(button(r.container, 'إضافة موظف').disabled).toBe(true);
    expect(r.container.textContent).toContain('للقراءة فقط');
  });

  it('names a 403 `support_read_only` as «للقراءة فقط» and keeps the announcement', async () => {
    const api = withA02(teamApi({ session: SUPPORT_SESSION }), { announcements: [WARNING] });
    api.answers[dismissPath(WARNING.id)] = () => errorAnswer(403, 'support_read_only');
    const { r } = await open('/', api);
    await click(button(banner('إعلان من شفاء') ?? r.container, 'إخفاء الإعلان'));
    await flush(40);
    expect(banner('إعلان من شفاء')?.textContent).toContain(WARNING.body);
    expect(pageText()).toContain('دخول الدعم لا يغيّر شيئًا في العيادة');
  });
});

describe('support session: the end', () => {
  it('asks before ending, then shows «أنهيت الدخول»', async () => {
    const api = supportApi();
    api.answers['/api/auth/support/end'] = () => new Response(null, { status: 204 });
    const { r } = await open('/', api);
    await click(button(banner('دخول الدعم') ?? r.container, 'إنهاء'));
    const ask = document.body.querySelector('[role="alertdialog"]');
    expect(ask?.textContent).toContain('إنهاء دخول الدعم؟');
    await click(button(ask as HTMLElement, 'إنهاء الدخول'));
    await flush(40);
    expect(api.calls).toContain('POST /api/auth/support/end');
    expect(pageText()).toContain('انتهى دخول الدعم');
    expect(pageText()).toContain('أنهيت الدخول');
  });

  it('shows the owner who ended it after a 401 `support_ended`', async () => {
    const api = supportApi();
    const { r } = await open('/', api);
    const ended = errorAnswer(401, 'session_expired', {
      reason: 'support_ended',
      supportEnded: { endedBy: 'owner', endedAt: new Date().toISOString(), ownerName: OWNER_NAME },
    });
    endEverything(api, ended);
    await r.router.options.context.shell.api.GET('/clinic/capabilities');
    await flush(80);
    expect(r.router.state.location.pathname).not.toBe('/sign-in');
    expect(pageText()).toContain('انتهى دخول الدعم');
    expect(pageText()).toContain(`أنهاه مالك العيادة ${OWNER_NAME}`);
  });

  it('says its time ran out after a 401 `support_ended` by expiry', async () => {
    const api = supportApi();
    const { r } = await open('/', api);
    const ended = errorAnswer(401, 'session_expired', {
      reason: 'support_ended',
      supportEnded: { endedBy: 'expiry', endedAt: new Date().toISOString(), ownerName: null },
    });
    endEverything(api, ended);
    await r.router.options.context.shell.api.GET('/clinic/capabilities');
    await flush(80);
    expect(pageText()).toContain('انتهت مدته');
  });
});
