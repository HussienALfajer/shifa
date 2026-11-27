// Usage chart, from the review of the A-02 components: the Tab stop is today also when the days
// arrive after loading; a month without activity says so instead of naming a highest day.
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderDir } from '../../test/support/index.ts';
import { Button } from '../button/button.tsx';
import { UsageChart, type UsageChartDay } from './usage-chart.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const DAYS: UsageChartDay[] = [
  { date: '2026-11-24', count: 3 },
  { date: '2026-11-25', count: 16 },
  { date: '2026-11-26', count: 14 },
];
const unit = (n: number) => `${String(n)} تسجيل دخول`;

function Loads() {
  const [days, setDays] = useState<UsageChartDay[] | null>(null);
  return (
    <>
      <Button
        onClick={() => {
          setDays(DAYS);
        }}
      >
        تحميل
      </Button>
      <UsageChart aria-label="آخر 3 أيام" days={days ?? []} loading={days === null} unit={unit} />
    </>
  );
}

describe.each(DIRS)('Usage chart review in %s', (dir) => {
  it('after loading, the one Tab stop is today', async () => {
    const screen = await renderDir(<Loads />, { dir });
    await screen.getByRole('button', { name: 'تحميل' }).click();
    const bars = () => [
      ...document.querySelectorAll<HTMLElement>('[data-slot="usage-bar"] button'),
    ];
    await expect.poll(() => bars().length).toBe(3);
    expect(bars().map((b) => b.tabIndex)).toEqual([-1, -1, 0]);
    await userEvent.tab();
    expect(document.activeElement).toBe(bars()[2]);
    await screen.unmount();
  });

  it('a month without activity says so in its summary', async () => {
    const screen = await renderDir(
      <UsageChart
        aria-label="آخر 3 أيام"
        days={DAYS.map((d) => ({ ...d, count: 0 }))}
        unit={unit}
      />,
      { dir },
    );
    const group = screen.getByRole('group', { name: 'آخر 3 أيام' }).element();
    const summary = document.getElementById(group.getAttribute('aria-describedby') ?? '');
    expect(summary?.textContent).toBe(
      dir === 'rtl' ? 'لا نشاط في هذه الأيام.' : 'No activity on these days.',
    );
    await screen.unmount();
  });
});
