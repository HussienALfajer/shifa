// Slice A-01-08 checkpoint 4: «أرشفة» and «استعادة» (the archive-preview, archive and restore
// rows of the slice's table; A-01b criteria 4, 9; OD-105): the confirmation reads the preview and
// names the members whose sessions here end; the last active branch cannot be archived (disabled
// with the reason; 409 `last_branch` inside the confirmation); 409 `branch_archived` moves it to
// archived; no connection stays in the confirmation. Archived: it leaves the cards, the team, the
// switcher and the menu read again. Restore puts it back; 409 `branch_not_archived` reads again.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  archivedRowOf,
  archivePath,
  BRANCHES_PATH,
  branchesApi,
  cardOf,
  confirmation,
  hasDialog,
  MAIN,
  OLD,
  openBranches,
  person,
  previewPath,
  restorePath,
  SECOND,
  THIRD,
} from './branches-support.ts';
import { button, click, flush, type Rendered } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.unstubAllGlobals();
});

const isDisabled = (el: HTMLElement) =>
  el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';

const NAMES = [person(), person()];

function archiving(options: Parameters<typeof branchesApi>[0] = {}) {
  const made = branchesApi(options);
  const { api, state } = made;
  api.answers[previewPath(SECOND.id)] = () =>
    json(200, {
      lastBranch: false,
      members: NAMES.map((name, i) => ({
        id: `7a1f4c1e-4a43-4f0e-9f61-3c3b1f6f0e4${String(i)}`,
        name,
      })),
    });
  api.answers[previewPath(THIRD.id)] = () => json(200, { lastBranch: false, members: [] });
  api.answers[archivePath(SECOND.id)] = () => {
    const done = { ...SECOND, archivedAt: new Date().toISOString() };
    state.active = state.active.filter((b) => b.id !== SECOND.id);
    state.archived = [...state.archived, done];
    return json(200, done);
  };
  return made;
}

async function openArchive(name: string, api = archiving().api) {
  shown = await openBranches(api);
  await click(button(cardOf(name), 'أرشفة'));
  await flush(40);
  return shown;
}

describe('«أرشفة»', () => {
  it('reads the preview and names the members whose sessions here end', async () => {
    const { api } = archiving();
    await openArchive(SECOND.name, api);
    expect(api.calls).toContain(`GET ${previewPath(SECOND.id)}`);
    const c = confirmation();
    expect(c.textContent).toContain(SECOND.name);
    for (const name of NAMES) expect(c.textContent).toContain(name);
  });

  it('no member left without a branch: says no session ends', async () => {
    await openArchive(THIRD.name);
    expect(confirmation().textContent).toContain('لن تنتهي جلسة أحد');
  });

  it('archived: the card leaves, the branch is listed archived, the team and the clinics read again', async () => {
    const { api } = archiving();
    const r = await openArchive(SECOND.name, api);
    const clinicsBefore = api.calls.filter((c) => c === 'GET /api/me/clinics').length;
    await click(button(confirmation(), 'أرشفة الفرع'));
    await flush(80);
    expect(api.calls).toContain(`POST ${archivePath(SECOND.id)}`);
    expect(hasDialog()).toBe(false);
    expect(() => cardOf(SECOND.name)).toThrow();
    expect(archivedRowOf(SECOND.name)).toBeDefined();
    expect(api.calls.filter((c) => c === 'GET /api/me/clinics').length).toBeGreaterThan(
      clinicsBefore,
    );
    expect(r.container.textContent).toContain(`أُرشف ${SECOND.name}`);
  });

  it('409 last_branch stays in the confirmation, named', async () => {
    const { api } = archiving();
    api.answers[archivePath(SECOND.id)] = () => errorAnswer(409, 'last_branch');
    await openArchive(SECOND.name, api);
    await click(button(confirmation(), 'أرشفة الفرع'));
    await flush(60);
    expect(confirmation().textContent).toContain('آخر فرع نشط');
  });

  it('409 branch_archived: closes and the list is read again (it moves to archived)', async () => {
    const { api } = archiving();
    api.answers[archivePath(SECOND.id)] = () => errorAnswer(409, 'branch_archived');
    await openArchive(SECOND.name, api);
    const before = api.calls.filter((c) => c === `GET ${BRANCHES_PATH}`).length;
    await click(button(confirmation(), 'أرشفة الفرع'));
    await flush(60);
    expect(hasDialog()).toBe(false);
    expect(api.calls.filter((c) => c === `GET ${BRANCHES_PATH}`).length).toBeGreaterThan(before);
  });

  it('no connection: stays in the confirmation, says it is not known', async () => {
    const { api } = archiving();
    api.answers[archivePath(SECOND.id)] = () => Promise.reject(new TypeError('offline'));
    await openArchive(SECOND.name, api);
    await click(button(confirmation(), 'أرشفة الفرع'));
    await flush(60);
    expect(confirmation().textContent).toContain('تعذّر الوصول إلى الخادم');
  });

  it('the preview says it is the last branch: the action is disabled with the reason', async () => {
    const { api } = archiving();
    api.answers[previewPath(SECOND.id)] = () => json(200, { lastBranch: true, members: [] });
    await openArchive(SECOND.name, api);
    expect(isDisabled(button(confirmation(), 'أرشفة الفرع'))).toBe(true);
    expect(confirmation().textContent).toContain('آخر فرع نشط');
  });
});

describe('the last active branch', () => {
  it('its «أرشفة» is disabled with the reason, the page stays', async () => {
    const r = await (async () => {
      shown = await openBranches(branchesApi({ active: [MAIN], archived: [OLD], solo: true }).api);
      return shown;
    })();
    expect(r.router.state.location.pathname).toBe('/branches');
    const archive = button(cardOf(MAIN.name), 'أرشفة');
    expect(isDisabled(archive)).toBe(true);
    const reason = archive.getAttribute('aria-describedby');
    const said = reason ? document.getElementById(reason)?.textContent : '';
    expect(said).toContain('آخر فرع نشط');
  });

  it('archiving down to one shows the last-branch state and the menu loses «الفروع»', async () => {
    const { api, state } = archiving({ active: [MAIN, SECOND] });
    const r = await openArchive(SECOND.name, api);
    await click(button(confirmation(), 'أرشفة الفرع'));
    await flush(80);
    expect(state.active).toHaveLength(1);
    expect(r.router.state.location.pathname).toBe('/branches');
    expect(isDisabled(button(cardOf(MAIN.name), 'أرشفة'))).toBe(true);
    expect(r.container.querySelector('nav a[href="/branches"]')).toBeNull();
  });
});

describe('«استعادة» (OD-105)', () => {
  it('puts it back among the cards; the clinics read again', async () => {
    const { api, state } = branchesApi();
    api.answers[restorePath(OLD.id)] = () => {
      const back = { ...OLD, archivedAt: null };
      state.archived = [];
      state.active = [...state.active, back];
      return json(200, back);
    };
    const r = await openBranches(api);
    shown = r;
    await click(button(archivedRowOf(OLD.name), 'استعادة'));
    await flush(80);
    expect(api.calls).toContain(`POST ${restorePath(OLD.id)}`);
    expect(cardOf(OLD.name)).toBeDefined();
    expect(r.container.textContent).toContain(`أُعيد ${OLD.name}`);
    expect(api.calls.filter((c) => c === 'GET /api/me/clinics').length).toBeGreaterThan(1);
  });

  it('409 branch_not_archived: the list is read again', async () => {
    const { api } = branchesApi();
    api.answers[restorePath(OLD.id)] = () => errorAnswer(409, 'branch_not_archived');
    shown = await openBranches(api);
    const before = api.calls.filter((c) => c === `GET ${BRANCHES_PATH}`).length;
    await click(button(archivedRowOf(OLD.name), 'استعادة'));
    await flush(60);
    expect(api.calls.filter((c) => c === `GET ${BRANCHES_PATH}`).length).toBeGreaterThan(before);
  });

  it('no connection: says it is not known', async () => {
    const { api } = branchesApi();
    api.answers[restorePath(OLD.id)] = () => Promise.reject(new TypeError('offline'));
    shown = await openBranches(api);
    await click(button(archivedRowOf(OLD.name), 'استعادة'));
    await flush(60);
    expect(shown.container.textContent).toContain('تعذّر الوصول إلى الخادم');
  });
});
