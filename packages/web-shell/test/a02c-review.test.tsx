// Slice A-02-10 review (2026-11-27), regression tests of its blocking findings: B1 «خروج» in a
// support session ends the grant (POST /auth/support/end, the one write it may make) and shows the
// ended page, never POST /auth/sign-out; B2 a support session opens a member's drawer (it has no
// GET /me/clinics entry, so the clinic's facts come from the session and the plan); B3 the plan's
// limits are read again after a change, so an archive frees «إضافة فرع» without leaving the page.
import { afterEach, describe, expect, it } from 'vitest';
import { must } from './a02-admin-support.ts';
import {
  ADMIN_NAME,
  ADMIN_PHONE,
  CAPABILITIES_PATH,
  capabilities,
  pageText,
  SUPPORT_SESSION,
  withA02,
} from './a02c-support.ts';
import {
  archivePath,
  branchesApi,
  cardOf,
  confirmation,
  openBranches,
  previewPath,
  SECOND,
} from './branches-support.ts';
import { button, click, flush, type Rendered, renderShell } from './render.tsx';
import { errorAnswer, json } from './support.ts';
import { DOCTOR, drawer, nameLink, openTeam, teamApi } from './team-support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

function supportApi() {
  const api = withA02(teamApi({ session: SUPPORT_SESSION }));
  api.answers['/api/me'] = () =>
    json(200, { userId: SUPPORT_SESSION.userId, name: ADMIN_NAME, phone: ADMIN_PHONE });
  // As the server: a support principal has no membership to list.
  api.answers['/api/me/clinics'] = () => errorAnswer(404, 'no_clinic');
  return api;
}

describe('A-02-10 review', () => {
  it('B1: «خروج» in a support session ends the grant and shows the ended page', async () => {
    const api = supportApi();
    api.answers['/api/auth/support/end'] = () => new Response(null, { status: 204 });
    shown = await renderShell('clinic', api, '/');
    await flush(60);
    await click(button(shown.container, 'خروج'));
    await flush(60);
    expect(api.calls).toContain('POST /api/auth/support/end');
    expect(api.calls).not.toContain('POST /api/auth/sign-out');
    expect(shown.router.state.location.pathname).toBe('/support/ended');
    expect(pageText()).toContain('أنهيت الدخول');
  });

  it('B1: a support session has no «حسابي»', async () => {
    shown = await renderShell('clinic', supportApi(), '/');
    await flush(60);
    const nav = must(shown.container.querySelector('nav'));
    expect(nav.textContent).not.toContain('حسابي');
  });

  it('B2: a support session reads a member in the drawer, as the owner sees it', async () => {
    shown = await openTeam(supportApi());
    await flush(60);
    await click(nameLink(DOCTOR.name));
    await flush(60);
    expect(drawer().textContent).toContain(DOCTOR.name);
    expect(drawer().textContent).toContain('الأدوار');
  });

  it('B3: archiving at the branches’ limit frees «إضافة فرع» on the same page', async () => {
    const { api, state } = branchesApi();
    withA02(api, { limits: [{ key: 'limits.branches', limit: 3, used: 3 }] });
    api.answers[previewPath(SECOND.id)] = () => json(200, { lastBranch: false, members: [] });
    api.answers[archivePath(SECOND.id)] = () => {
      const done = { ...SECOND, archivedAt: new Date().toISOString() };
      state.active = state.active.filter((b) => b.id !== SECOND.id);
      state.archived = [...state.archived, done];
      api.answers[CAPABILITIES_PATH] = () =>
        json(200, capabilities([{ key: 'limits.branches', limit: 3, used: 2 }]));
      return json(200, done);
    };
    shown = await openBranches(api);
    expect(button(shown.container, 'إضافة فرع').disabled).toBe(true);
    await click(button(cardOf(SECOND.name), 'أرشفة'));
    await flush(40);
    await click(button(confirmation(), 'أرشفة الفرع'));
    await flush(80);
    expect(button(shown.container, 'إضافة فرع').disabled).toBe(false);
  });
});
