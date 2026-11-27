// PageBanner, from the review of the A-02 components: the pager keeps the keyboard's focus at
// either end (aria-disabled, as Pagination); the shown one stays inside the list when it shrinks;
// a single announcement has no pager.
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderDir } from '../../test/support/index.ts';
import { PageBanner } from './page-banner.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const TEXTS = ['أول', 'ثانٍ', 'ثالث'];

function Several({ start = 0, count = 3 }: { start?: number; count?: number }) {
  const [index, setIndex] = useState(start);
  return (
    <PageBanner tone="info" title="معلومة:" pager={{ index, count, onIndexChange: setIndex }}>
      {TEXTS[Math.min(index, count - 1)]}
    </PageBanner>
  );
}

describe.each(DIRS)('PageBanner review in %s', (dir) => {
  const next = dir === 'rtl' ? 'الإعلان التالي' : 'Next announcement';
  const counter = () => document.querySelector('[data-slot="page-banner-pager"]')?.textContent;

  it('keeps the focus on next when it reaches the end, and ignores another press', async () => {
    const screen = await renderDir(<Several />, { dir });
    const button = screen.getByRole('button', { name: next }).element() as HTMLElement;
    button.focus();
    await userEvent.keyboard('{Enter}{Enter}');
    expect(counter()).toContain(dir === 'rtl' ? '3 من 3' : '3 of 3');
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await userEvent.keyboard('{Enter}');
    expect(counter()).toContain(dir === 'rtl' ? '3 من 3' : '3 of 3');
    await screen.unmount();
  });

  it('shows the last one when the list shrinks under the index', async () => {
    const screen = await renderDir(<Several start={2} count={2} />, { dir });
    expect(counter()).toContain(dir === 'rtl' ? '2 من 2' : '2 of 2');
    await screen.unmount();
  });

  it('draws no pager for a single announcement', async () => {
    const screen = await renderDir(<Several count={1} />, { dir });
    expect(counter()).toBeUndefined();
    await screen.unmount();
  });
});
