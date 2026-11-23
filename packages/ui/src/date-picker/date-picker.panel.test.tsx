// Date Picker month and year panel (slice 0.4-13 criterion 14, OD-68 B): the heading is a button
// with aria-expanded and aria-controls; it swaps the days for one panel with a year list at the
// logical start beside a 3 × 4 grid of Levantine month names; two presses reach March 1987 from
// November 2026. Keys: Up/Down a year, Page Up/Down ten, Home/End the ends, typed digits jump to
// a year, Enter goes on to the months; in the month grid arrows follow the reading direction,
// Down is three months, Enter chooses. Escape goes back one step and never closes the popover
// from the panel. Months outside min/max are disabled, read and focusable, never chosen. The
// year list opens scrolled to the chosen year. «هذا الشهر» returns to today's month. Axe clean.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { arrows, expectAxeClean, renderDir } from '../../test/support/index.ts';
import { DatePicker } from './date-picker.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const LABEL = 'تاريخ الميلاد';
const T = {
  rtl: {
    november: 'تشرين الثاني 2026',
    march1987: 'آذار 1987',
    march: 'آذار',
    november2: 'تشرين الثاني',
    december: 'كانون الأول',
    february: 'شباط',
    years: 'السنة',
    months: 'الشهر',
    thisMonth: 'هذا الشهر',
  },
  ltr: {
    november: 'November 2026',
    march1987: 'March 1987',
    march: 'March',
    november2: 'November',
    december: 'December',
    february: 'February',
    years: 'Year',
    months: 'Month',
    thisMonth: 'This month',
  },
} as const;

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });
const active = () => document.activeElement;
const activeText = () => document.activeElement?.textContent.trim();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 23, 12));
});
afterEach(() => {
  vi.useRealTimers();
});

async function openPanel(
  dir: 'rtl' | 'ltr',
  props: Partial<Parameters<typeof DatePicker>[0]> = {},
) {
  const screen = await renderDir(
    <div className="flex justify-center p-16">
      <DatePicker label={LABEL} {...props} />
    </div>,
    { dir },
  );
  await userEvent.click(screen.getByRole('button', { name: 'فتح التقويم' }));
  await expect.element(screen.getByRole('grid')).toBeVisible();
  const heading = screen.getByRole('button', { name: T[dir].november });
  return { screen, heading };
}

describe.each(DIRS)('Date Picker month and year panel in %s', (dir) => {
  it('the heading is a button that opens one panel of years and months', async () => {
    const { screen, heading } = await openPanel(dir);
    await expect.element(heading).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(heading);
    await expect.element(heading).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(heading.element().getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    const years = screen.getByRole('listbox', { name: T[dir].years });
    const months = screen.getByRole('grid', { name: T[dir].months });
    await expect.element(years).toBeVisible();
    await expect.element(months).toBeVisible();
    expect(panel?.contains(years.element())).toBe(true);
    expect(screen.getByRole('gridcell').elements()).toHaveLength(12);
    // The year list sits at the logical start of the panel.
    const y = years.element().getBoundingClientRect();
    const m = months.element().getBoundingClientRect();
    expect(dir === 'rtl' ? y.left > m.left : y.left < m.left).toBe(true);
  });

  it('reaches March 1987 from November 2026 in two presses', async () => {
    const { screen, heading } = await openPanel(dir);
    await userEvent.click(heading);
    await userEvent.click(screen.getByRole('option', { name: '1987' }));
    await userEvent.click(screen.getByRole('button', { name: T[dir].march, exact: true }));
    await expect.element(screen.getByRole('button', { name: T[dir].march1987 })).toBeVisible();
    await expect.element(screen.getByRole('grid')).toBeVisible();
    expect(screen.getByRole('listbox').elements()).toHaveLength(0);
  });

  it('opens on the chosen year, scrolled into view, and focuses it', async () => {
    const { screen } = await openPanel(dir, { defaultValue: '1987-03-14' });
    await userEvent.click(screen.getByRole('button', { name: T[dir].march1987 }));
    const option = screen.getByRole('option', { name: '1987' }).element();
    await poll(active, 'focus on 1987').toBe(option);
    expect(option.getAttribute('aria-selected')).toBe('true');
    const list = screen.getByRole('listbox').element();
    const scroller = list.closest('[data-slot="year-scroll"]') ?? list;
    const o = option.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    expect(o.top).toBeGreaterThanOrEqual(s.top - 1);
    expect(o.bottom).toBeLessThanOrEqual(s.bottom + 1);
  });

  it('year keys: Up/Down a year, Page Up/Down ten, Home/End, typed digits', async () => {
    const { heading } = await openPanel(dir);
    heading.element().focus();
    await userEvent.keyboard('{Enter}');
    await poll(activeText, 'on this year').toBe('2026');
    await userEvent.keyboard('{ArrowUp}');
    await poll(activeText, 'a year back').toBe('2025');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await poll(activeText, 'a year on').toBe('2027');
    await userEvent.keyboard('{PageUp}');
    await poll(activeText, 'ten years back').toBe('2017');
    await userEvent.keyboard('{Home}');
    await poll(activeText, 'the first year').toBe('1900');
    await userEvent.keyboard('{End}');
    await poll(activeText, 'the last year').toBe('2036');
    await userEvent.keyboard('1987');
    await poll(activeText, 'typed year').toBe('1987');
  });

  it('Enter on a year goes to its months; arrows follow the reading direction; Enter chooses', async () => {
    const { screen, heading } = await openPanel(dir);
    heading.element().focus();
    await userEvent.keyboard('{Enter}');
    await poll(activeText, 'on this year').toBe('2026');
    await userEvent.keyboard('1987{Enter}');
    await poll(activeText, 'on the shown month').toBe(T[dir].november2);
    await userEvent.keyboard(`{${arrows(dir).forward}}`);
    await poll(activeText, 'forward is the next month').toBe(T[dir].december);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    await poll(activeText, 'up is three months back').toBe(T[dir].march);
    await userEvent.keyboard('{Enter}');
    await expect.element(screen.getByRole('button', { name: T[dir].march1987 })).toBeVisible();
    await poll(
      () => active()?.closest('[role="grid"]') !== null && activeText() === '1',
      'focus on a day of March',
    ).toBe(true);
  });

  it('Escape goes back one step and never closes the popover from the panel', async () => {
    const { screen, heading } = await openPanel(dir);
    heading.element().focus();
    await userEvent.keyboard('{Enter}');
    await poll(activeText, 'years').toBe('2026');
    await userEvent.keyboard('{Enter}');
    await poll(activeText, 'months').toBe(T[dir].november2);
    await userEvent.keyboard('{Escape}');
    await poll(activeText, 'back to the years').toBe('2026');
    await expect.element(screen.getByRole('dialog')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
    await expect.element(screen.getByRole('dialog')).toBeVisible();
    await poll(active, 'focus on the heading').toBe(heading.element());
    await expect.element(heading).toHaveAttribute('aria-expanded', 'false');
  });

  it('months outside min and max are disabled, read and focusable, never chosen', async () => {
    const { screen, heading } = await openPanel(dir, { min: '2026-11-20' });
    await userEvent.click(heading);
    const feb = screen.getByRole('button', { name: T[dir].february, exact: true });
    await expect.element(feb).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(feb, { force: true });
    await expect.element(screen.getByRole('listbox')).toBeVisible();
    // Reachable by the keyboard.
    screen.getByRole('button', { name: T[dir].november2, exact: true }).element().focus();
    await userEvent.keyboard('{ArrowUp}');
    await poll(activeText, 'August, disabled, focused').toBe(dir === 'rtl' ? 'آب' : 'August');
    await userEvent.keyboard('{Enter}');
    await expect.element(screen.getByRole('listbox')).toBeVisible();
    // The year list starts at min's year.
    expect(screen.getByRole('option').elements()[0]?.textContent.trim()).toBe('2026');
  });

  it('«this month» returns to today’s month', async () => {
    const { screen, heading } = await openPanel(dir, { defaultValue: '1987-03-14' });
    await userEvent.click(screen.getByRole('button', { name: T[dir].march1987 }));
    await userEvent.click(screen.getByRole('button', { name: T[dir].thisMonth }));
    await expect.element(heading).toBeVisible();
    await expect.element(screen.getByRole('grid')).toBeVisible();
  });

  it('is clean under axe with the panel open, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<DatePicker label={LABEL} min="2026-11-20" />, {
        dir,
        theme,
      });
      await userEvent.click(screen.getByRole('button', { name: 'فتح التقويم' }));
      await userEvent.click(screen.getByRole('button', { name: T[dir].november }));
      await expect.element(screen.getByRole('listbox')).toBeVisible();
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
