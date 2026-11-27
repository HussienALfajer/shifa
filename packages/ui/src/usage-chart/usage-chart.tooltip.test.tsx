// Usage chart: the open Tooltip follows the focused day (A-02-01, sheet A02SheetUsageChart). Every
// bar's tooltip names it, so all of them stay in the page; the open one is the focused day's.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderDir } from '../../test/support/index.ts';
import { UsageChart } from './usage-chart.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const DAYS = [
  { date: '2026-11-24', count: 3 },
  { date: '2026-11-25', count: 16 },
  { date: '2026-11-26', count: 14 },
];
const open = () => document.querySelector('[role="tooltip"][data-open]')?.textContent;

describe.each(DIRS)('Usage chart tooltip in %s', (dir) => {
  it('opens on the focused day and moves with the arrows', async () => {
    const screen = await renderDir(
      <UsageChart aria-label="آخر 3 أيام" days={DAYS} unit={(n) => `${String(n)} تسجيل دخول`} />,
      { dir },
    );
    await userEvent.tab();
    await expect.poll(open).toBe('14 تسجيل دخول · 26/11');
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(open).toBe('16 تسجيل دخول · 25/11');
    expect(document.querySelectorAll('[role="tooltip"][data-open]')).toHaveLength(1);
    await userEvent.keyboard('{Escape}');
    await expect.poll(open).toBeUndefined();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('16 تسجيل دخول · 25/11');
    await screen.unmount();
  });
});
