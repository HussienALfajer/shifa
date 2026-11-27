// Usage chart (A-02-01, sheet A02SheetUsageChart approved by the owner 2026-11-27): 30 daily
// counts as bars, time from left to right in both directions; a y-axis with quarter lines; the
// daily average as a dashed gold line with its figure; today in gold, a day without activity a
// thin line. Each bar is the system's Tooltip trigger (the figure, then the day). One Tab stop,
// the arrows move between days; a screen reader hears a summary (total, average, highest day).
// Empty and loading states. No charting library.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { UsageChart, type UsageChartDay } from './usage-chart.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const COUNTS = [
  6, 9, 11, 0, 0, 12, 14, 10, 13, 8, 0, 7, 15, 16, 12, 11, 9, 0, 13, 18, 21, 17, 14, 0, 0, 12, 15,
  19, 16, 14,
];

/** 30 days ending on 26/11/2026 (Damascus days, as the API sends them). */
function days(counts: number[]): UsageChartDay[] {
  const end = Date.UTC(2026, 10, 26);
  return counts.map((count, i) => ({
    date: new Date(end - (counts.length - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    count,
  }));
}

const unit = (dir: 'rtl' | 'ltr') => (n: number) =>
  dir === 'rtl' ? `${String(n)} تسجيل دخول` : `${String(n)} sign-ins`;
const bars = () => [...document.querySelectorAll<HTMLElement>('[data-slot="usage-bar"]')];
const fillOf = (bar: HTMLElement | undefined) =>
  bar?.querySelector<HTMLElement>('[data-slot="usage-fill"]') ?? document.body;
const buttonOf = (bar: HTMLElement) => bar.querySelector<HTMLElement>('button') ?? bar;

describe.each(DIRS)('Usage chart in %s', (dir) => {
  const label = dir === 'rtl' ? 'آخر 30 يومًا' : 'Last 30 days';
  const render = (counts = COUNTS) =>
    renderDir(<UsageChart aria-label={label} days={days(counts)} unit={unit(dir)} />, { dir });

  it('draws a named group of 30 days, oldest at the left in both directions', async () => {
    const screen = await render();
    expect(screen.getByRole('group', { name: label }).element()).toBeTruthy();
    expect(bars()).toHaveLength(30);
    const [first, last] = [bars()[0], bars()[29]];
    expect(first?.getBoundingClientRect().left).toBeLessThan(
      last?.getBoundingClientRect().left ?? 0,
    );
    await screen.unmount();
  });

  it('has one Tab stop, today; the arrows move between days by their place, Home and End', async () => {
    const screen = await render();
    const buttons = bars().map(buttonOf);
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    await userEvent.tab();
    expect(document.activeElement).toBe(buttons[29]);
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(buttons[28]);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(buttons[29]);
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(buttons[0]);
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(buttons[0]);
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(buttons[29]);
    expect(buttons.filter((b) => b.tabIndex === 0)).toEqual([buttons[29]]);
    await screen.unmount();
  });

  it('a focused bar opens the Tooltip with its figure, then its day, and is named by it', async () => {
    const screen = await render();
    await userEvent.tab();
    await userEvent.keyboard('{Home}');
    const text = dir === 'rtl' ? '6 تسجيل دخول · 28/10' : '6 sign-ins · 28/10';
    await expect.poll(() => document.querySelector('[role="tooltip"]')?.textContent).toBe(text);
    expect(screen.getByRole('button', { name: text }).element()).toBe(document.activeElement);
    await screen.unmount();
  });

  it('scales bars on a y-axis in quarters, with the average line', async () => {
    const screen = await render();
    const axis = [...document.querySelectorAll('[data-slot="usage-y-axis"] span')].map(
      (s) => s.textContent,
    );
    expect(axis).toEqual(['0', '6', '12', '18', '24']);
    const plot = document.querySelector<HTMLElement>('[data-slot="usage-plot"]');
    const plotHeight = plot?.getBoundingClientRect().height ?? 0;
    const highest = fillOf(bars()[20]).getBoundingClientRect().height;
    expect(Math.abs(highest - (plotHeight * 21) / 24)).toBeLessThan(2);
    const zero = fillOf(bars()[3]).getBoundingClientRect().height;
    expect(zero).toBeGreaterThan(0);
    expect(zero).toBeLessThanOrEqual(3);
    const average = document.querySelector<HTMLElement>('[data-slot="usage-average"]');
    expect(average?.textContent).toBe(dir === 'rtl' ? 'المتوسط 10.4' : 'Average 10.4');
    const top =
      (plot?.getBoundingClientRect().bottom ?? 0) - (average?.getBoundingClientRect().top ?? 0);
    expect(Math.abs(top - (plotHeight * 10.4) / 24)).toBeLessThan(2);
    await screen.unmount();
  });

  it('small counts: an axis of whole numbers', async () => {
    const screen = await render([
      0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1,
    ]);
    const axis = [...document.querySelectorAll('[data-slot="usage-y-axis"] span')].map(
      (s) => s.textContent,
    );
    expect(axis).toEqual(['0', '1', '2', '3', '4']);
    await screen.unmount();
  });

  it('colours: past days in the brand colour, today in gold, an empty day in the strong border', async () => {
    const screen = await render();
    const chart = screen.getByRole('group', { name: label }).element();
    const bg = (i: number) => getComputedStyle(fillOf(bars()[i])).backgroundColor;
    expect(bg(0)).toBe(tokenColor('--shifa-color-brand-primary', chart));
    expect(bg(29)).toBe(tokenColor('--shifa-color-brand-accent', chart));
    expect(bg(3)).toBe(tokenColor('--shifa-color-border-strong', chart));
    await screen.unmount();
  });

  it('tells screen readers the total, the daily average and the highest day', async () => {
    const screen = await render();
    const group = screen.getByRole('group', { name: label }).element();
    const id = group.getAttribute('aria-describedby') ?? '';
    const summary = document.getElementById(id)?.textContent ?? '';
    for (const part of ['312', '10.4', '21', '17/11']) expect(summary).toContain(part);
    await screen.unmount();
  });

  it('shows the legend and the x-axis with today', async () => {
    const screen = await render();
    const text = document.querySelector('[data-slot="usage-chart"]')?.textContent ?? '';
    const words =
      dir === 'rtl'
        ? ['28/10', 'اليوم', 'يوم مضى', 'اليوم حتى الآن', 'المتوسط اليومي']
        : ['28/10', 'Today', 'Past day', 'Today so far', 'Daily average'];
    for (const w of words) expect(text).toContain(w);
    await screen.unmount();
  });

  it('empty: the empty state, no bars', async () => {
    const screen = await renderDir(<UsageChart aria-label={label} days={[]} unit={unit(dir)} />, {
      dir,
    });
    expect(bars()).toHaveLength(0);
    const title = dir === 'rtl' ? 'لا بيانات بعد' : 'No data yet';
    expect(screen.getByRole('heading', { name: title }).element()).toBeTruthy();
    await screen.unmount();
  });

  it('loading: busy, a placeholder, no bars', async () => {
    const screen = await renderDir(
      <UsageChart aria-label={label} days={[]} unit={unit(dir)} loading />,
      { dir },
    );
    expect(bars()).toHaveLength(0);
    const group = screen.getByRole('group', { name: label }).element();
    expect(group.getAttribute('aria-busy')).toBe('true');
    expect(group.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    await screen.unmount();
  });

  it.each(['light', 'dark'] as const)('is axe clean in %s, data and empty', async (theme) => {
    const screen = await renderDir(
      <>
        <UsageChart aria-label={label} days={days(COUNTS)} unit={unit(dir)} />
        <UsageChart aria-label={`${label} 2`} days={[]} unit={unit(dir)} />
      </>,
      { dir, theme },
    );
    await expectAxeClean(screen.container);
    await userEvent.tab();
    await expectAxeClean(screen.container);
    await screen.unmount();
  });
});
