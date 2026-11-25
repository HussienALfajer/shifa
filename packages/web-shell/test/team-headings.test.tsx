// Slice A-01-08 checkpoint 5: axe on the real backend found the team page's empty state as an
// `h3` right under the page's `h1` (heading-order). The page's empty states are `h2`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flush, type Rendered, type as typeInto } from './render.tsx';
import { B_SECOND, openTeam, SELF, teamApi } from './team-support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.unstubAllGlobals();
});

const headingOf = (words: string) =>
  [...document.querySelectorAll('h1, h2, h3, h4')].find((h) => h.textContent.includes(words));

describe('team page headings', () => {
  it('the owner alone: «أنت وحدك في الفريق الآن» is an h2 under the h1', async () => {
    shown = await openTeam(teamApi({ members: [SELF] }), '/team');
    expect(headingOf('الفريق')?.tagName).toBe('H1');
    expect(headingOf('أنت وحدك في الفريق الآن')?.tagName).toBe('H2');
  });

  it('a search with no match: its title is an h2', async () => {
    shown = await openTeam(teamApi(), '/team');
    const search = shown.container.querySelector<HTMLInputElement>(
      'input[aria-label="ابحث بالاسم أو الرقم"]',
    );
    if (!search) throw new Error('no search field');
    await typeInto(search, 'لا أحد بهذا');
    await flush(20);
    expect(headingOf('لا أحد بهذا الاسم أو الرقم')?.tagName).toBe('H2');
  });

  it('under the branch filter’s h2, a search with no match is an h3', async () => {
    shown = await openTeam(teamApi(), `/team?branch=${B_SECOND.id}`);
    expect(headingOf(`فريق ${B_SECOND.name}`)?.tagName).toBe('H2');
    const search = shown.container.querySelector<HTMLInputElement>(
      'input[aria-label="ابحث بالاسم أو الرقم"]',
    );
    if (!search) throw new Error('no search field');
    await typeInto(search, 'لا أحد بهذا');
    await flush(20);
    expect(headingOf('لا أحد بهذا الاسم أو الرقم')?.tagName).toBe('H3');
  });
});
