// Slice A-01-08 checkpoint 4 review: (B1) the archive preview answering 409 `branch_archived` or
// 404 closes the confirmation, names it and reads the list again; (N3) a preview saying it is now
// the last branch reads the list again; (N4) one affected member is named in the singular; (N5)
// each card is a group named by its branch; (N7) a restore answered 404 says the branch is gone.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  archivedRowOf,
  BRANCHES_PATH,
  branchesApi,
  cardOf,
  confirmation,
  hasDialog,
  OLD,
  openBranches,
  person,
  previewPath,
  restorePath,
  SECOND,
} from './branches-support.ts';
import { button, click, flush, type Rendered } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.unstubAllGlobals();
});

const reads = (calls: string[]) => calls.filter((c) => c === `GET ${BRANCHES_PATH}`).length;

describe('the archive preview’s refusals (B1)', () => {
  it('409 branch_archived: closes, says it was archived, reads the list again', async () => {
    const { api } = branchesApi();
    api.answers[previewPath(SECOND.id)] = () => errorAnswer(409, 'branch_archived');
    shown = await openBranches(api);
    const before = reads(api.calls);
    await click(button(cardOf(SECOND.name), 'أرشفة'));
    await flush(80);
    expect(hasDialog()).toBe(false);
    expect(shown.container.textContent).toContain(`أُرشف ${SECOND.name}`);
    expect(reads(api.calls)).toBeGreaterThan(before);
  });

  it('404: closes, says the branch is gone, reads the list again', async () => {
    const { api } = branchesApi();
    api.answers[previewPath(SECOND.id)] = () => errorAnswer(404, 'not_found');
    shown = await openBranches(api);
    const before = reads(api.calls);
    await click(button(cardOf(SECOND.name), 'أرشفة'));
    await flush(80);
    expect(hasDialog()).toBe(false);
    expect(shown.container.textContent).toContain('لم يعد هذا الفرع موجوداً');
    expect(reads(api.calls)).toBeGreaterThan(before);
  });

  it('a preview that says last branch reads the list again (N3)', async () => {
    const { api } = branchesApi();
    api.answers[previewPath(SECOND.id)] = () => json(200, { lastBranch: true, members: [] });
    shown = await openBranches(api);
    const before = reads(api.calls);
    await click(button(cardOf(SECOND.name), 'أرشفة'));
    await flush(80);
    expect(confirmation().textContent).toContain('آخر فرع نشط');
    expect(reads(api.calls)).toBeGreaterThan(before);
  });
});

describe('words and names', () => {
  it('one affected member is named in the singular (N4)', async () => {
    const { api } = branchesApi();
    const name = person();
    api.answers[previewPath(SECOND.id)] = () =>
      json(200, {
        lastBranch: false,
        members: [{ id: '7a1f4c1e-4a43-4f0e-9f61-3c3b1f6f0e41', name }],
      });
    shown = await openBranches(api);
    await click(button(cardOf(SECOND.name), 'أرشفة'));
    await flush(60);
    const text = confirmation().textContent;
    expect(text).toContain(name);
    expect(text).not.toContain('هؤلاء');
  });

  it('each card is a group named by its branch (N5)', async () => {
    shown = await openBranches(branchesApi().api);
    const card = cardOf(SECOND.name);
    const group = card.querySelector('[role="group"]') ?? card;
    expect(group.getAttribute('role')).toBe('group');
    const id = group.getAttribute('aria-labelledby') ?? '';
    expect(document.getElementById(id)?.textContent).toBe(SECOND.name);
  });

  it('a restore answered 404 says the branch is gone (N7)', async () => {
    const { api } = branchesApi();
    api.answers[restorePath(OLD.id)] = () => errorAnswer(404, 'not_found');
    shown = await openBranches(api);
    await click(button(archivedRowOf(OLD.name), 'استعادة'));
    await flush(60);
    expect(shown.container.textContent).toContain('لم يعد هذا الفرع موجوداً');
  });
});
