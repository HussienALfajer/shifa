// Pagination (slice 0.4-07), as the owner approved the sheet on 2026-11-22 (OD-64): previous and
// next with arrows that mirror in RTL, page numbers with ellipses, the current page announced
// (aria-current="page"), an optional page-size select (25, 50, 100) and a «عرض 51–75 من 312» line
// in Western digits with grouping (OD-20, OD-61). Controlled: it fetches nothing. Tab reaches
// every button (navigation, not a toolbar).
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir } from '../../test/support/index.ts';
import { Pagination, pageItems } from './pagination.tsx';

const DIRS = ['rtl', 'ltr'] as const;

function Controlled({
  initial = 3,
  onPageChange,
  onPageSizeChange,
  totalItems = 312,
}: {
  initial?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  totalItems?: number;
}) {
  const [page, setPage] = useState(initial);
  const [pageSize, setPageSize] = useState(25);
  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      totalItems={totalItems}
      pageSizes={[25, 50, 100]}
      onPageChange={(p) => {
        setPage(p);
        onPageChange?.(p);
      }}
      onPageSizeChange={(s) => {
        setPageSize(s);
        onPageSizeChange?.(s);
      }}
    />
  );
}

describe('pageItems', () => {
  it('near the start: the first five, an ellipsis, the last', () => {
    expect(pageItems(3, 13)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 13]);
  });
  it('in the middle: ellipses on both sides', () => {
    expect(pageItems(7, 13)).toEqual([1, 'ellipsis', 6, 7, 8, 'ellipsis', 13]);
  });
  it('near the end', () => {
    expect(pageItems(12, 13)).toEqual([1, 'ellipsis', 9, 10, 11, 12, 13]);
  });
  it('few pages: all of them', () => {
    expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(1, 1)).toEqual([1]);
  });
});

describe.each(DIRS)('Pagination in %s', (dir) => {
  it('is a named navigation with the current page announced', async () => {
    const screen = await renderDir(<Controlled />, { dir });
    expect(screen.getByRole('navigation', { name: 'ترقيم الصفحات' }).element()).toBeTruthy();
    const current = screen.getByRole('button', { name: 'الصفحة 3' }).element();
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(
      screen.getByRole('button', { name: 'الصفحة 4' }).element().hasAttribute('aria-current'),
    ).toBe(false);
    await screen.unmount();
  });

  it('previous at the logical start and next at the end, arrows mirrored', async () => {
    const screen = await renderDir(<Controlled />, { dir });
    const prev = screen.getByRole('button', { name: 'الصفحة السابقة' }).element();
    const next = screen.getByRole('button', { name: 'الصفحة التالية' }).element();
    const p = prev.getBoundingClientRect();
    const n = next.getBoundingClientRect();
    if (dir === 'rtl') expect(p.left).toBeGreaterThan(n.left);
    else expect(p.left).toBeLessThan(n.left);
    // The previous arrow points toward the start: mirrored in RTL. Icons mirror with the CSS
    // `scale` property, as icon.test.tsx reads it (owner, 2026-11-22: the first version read
    // `transform`, which a scale utility leaves at none).
    const prevIcon = prev.querySelector('svg') as SVGElement;
    const mirrored = getComputedStyle(prevIcon).scale.startsWith('-1');
    expect(mirrored).toBe(dir === 'rtl');
    await screen.unmount();
  });

  it('moves with previous, next and a page number', async () => {
    const onPageChange = vi.fn();
    const screen = await renderDir(<Controlled onPageChange={onPageChange} />, { dir });
    await userEvent.click(screen.getByRole('button', { name: 'الصفحة التالية' }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
    await userEvent.click(screen.getByRole('button', { name: 'الصفحة السابقة' }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'الصفحة 13' }));
    expect(onPageChange).toHaveBeenLastCalledWith(13);
    expect(
      screen.getByRole('button', { name: 'الصفحة التالية' }).element().hasAttribute('disabled') ||
        screen
          .getByRole('button', { name: 'الصفحة التالية' })
          .element()
          .getAttribute('aria-disabled') === 'true',
    ).toBe(true);
    await screen.unmount();
  });

  it('on the first page, previous is disabled', async () => {
    const screen = await renderDir(<Controlled initial={1} />, { dir });
    const prev = screen.getByRole('button', { name: 'الصفحة السابقة' }).element();
    expect(prev.hasAttribute('disabled') || prev.getAttribute('aria-disabled') === 'true').toBe(
      true,
    );
    await screen.unmount();
  });

  it('the ellipsis is hidden from screen readers', async () => {
    const screen = await renderDir(<Controlled initial={7} />, { dir });
    const ellipses = [...document.querySelectorAll('[data-slot="pagination-ellipsis"]')];
    expect(ellipses).toHaveLength(2);
    for (const e of ellipses) expect(e.getAttribute('aria-hidden')).toBe('true');
    await screen.unmount();
  });

  it('says what is shown in Western digits with grouping', async () => {
    const screen = await renderDir(<Controlled totalItems={1250} />, { dir });
    expect(screen.getByText('عرض 51–75 من 1,250').element()).toBeTruthy();
    await screen.unmount();
  });

  it('a page-size change calls back and returns to page 1', async () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    const screen = await renderDir(
      <Controlled onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />,
      { dir },
    );
    await userEvent.click(screen.getByRole('combobox', { name: 'صفوف في الصفحة' }));
    await userEvent.click(screen.getByRole('option', { name: '50' }));
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    await expect
      .poll(() => document.body.textContent.includes('عرض 1–50 من 312'), { timeout: 1000 })
      .toBe(true);
    await screen.unmount();
  });

  it('Tab reaches every page button', async () => {
    const screen = await renderDir(<Controlled />, { dir });
    const nav = screen.getByRole('navigation').element();
    const buttons = [...nav.querySelectorAll('button:not([disabled])')];
    let reached = 0;
    for (let i = 0; i < buttons.length + 2; i++) {
      await userEvent.tab();
      if (buttons.some((b) => b === document.activeElement)) reached += 1;
    }
    expect(reached).toBeGreaterThanOrEqual(buttons.length);
    await screen.unmount();
  });

  it('the compact form says «الصفحة 3 من 13»', async () => {
    const screen = await renderDir(
      <Pagination
        page={3}
        pageSize={25}
        totalItems={312}
        form="compact"
        onPageChange={() => undefined}
      />,
      { dir },
    );
    expect(screen.getByText('الصفحة 3 من 13').element()).toBeTruthy();
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
    await screen.unmount();
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<Controlled initial={7} />, { dir, theme });
      await expectAxeClean(document.body);
      await screen.unmount();
    }
  });
});
