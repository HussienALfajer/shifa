// RTL gate (spec 0.4 criterion 7, slice 0.4-04): Date Picker in Arabic RTL and English LTR. The
// field shows dd/mm/yyyy in Western digits and accepts typed Arabic-Indic digits (OD-20, OD-61);
// the calendar opens below the field at its logical start, Gregorian, the week starting on
// Saturday, Levantine month names in Arabic; the forward arrow of the reading direction moves to
// the next day, Down a week, Page Down a month; days before `min` are disabled; Enter chooses and
// Escape closes, both with focus back on the calendar button; axe is clean. Typeahead does not
// apply (n/a).
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { arrows, expectAxeClean, renderDir, waitForPopupSide } from '../../test/support/index.ts';
import { DatePicker } from './date-picker.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const OPEN = { rtl: 'فتح التقويم', ltr: 'فتح التقويم' } as const;

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

async function setup(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof DatePicker>[0]> = {}) {
  const onValueChange = vi.fn();
  const screen = await renderDir(
    <div className="flex justify-center p-16">
      <DatePicker
        label="تاريخ الموعد"
        defaultValue="2026-11-24"
        min="2026-11-20"
        onValueChange={onValueChange}
        {...props}
      />
    </div>,
    { dir },
  );
  // Since 0.4-13 the field is a group of three spinbuttons (day / month / year), not a textbox.
  const input = screen.getByRole('group', { name: 'تاريخ الموعد' }).element() as HTMLElement;
  const button = screen.getByRole('button', { name: OPEN[dir] }).element() as HTMLElement;
  return { screen, input, button, onValueChange };
}

async function openCalendar(
  dir: 'rtl' | 'ltr',
  props: Partial<Parameters<typeof DatePicker>[0]> = {},
) {
  const s = await setup(dir, props);
  await userEvent.click(s.button);
  const grid = s.screen.getByRole('grid');
  await expect.element(grid).toBeVisible();
  return { ...s, grid: grid.element() as HTMLElement };
}

/** What a person reads: the three segments as dd/mm/yyyy. */
const shown = (group: HTMLElement) =>
  [...group.querySelectorAll('input')].map((segment) => segment.value).join('/');

/** The focused day, as its day-of-month number. */
const focusedDay = () => document.activeElement?.textContent.trim();

describe.each(DIRS)('Date Picker gate in %s', (dir) => {
  it('shows the date as dd/mm/yyyy in Western digits', async () => {
    const { input } = await setup(dir);
    expect(shown(input)).toBe('24/11/2026');
  });

  it('accepts a date typed in Arabic-Indic or Western digits', async () => {
    const { input, onValueChange } = await setup(dir, { defaultValue: null });
    for (const typed of ['٢٥١١٢٠٢٦', '26112026']) {
      input.querySelector('input')?.focus();
      await userEvent.keyboard(typed);
      await poll(() => onValueChange.mock.lastCall?.[0], `${typed} is understood`).toBe(
        typed.startsWith('٢') ? '2026-11-25' : '2026-11-26',
      );
      expect(shown(input)).toBe(typed.startsWith('٢') ? '25/11/2026' : '26/11/2026');
    }
  });

  it('opens the calendar below the field, aligned to its logical start', async () => {
    const { screen, input } = await openCalendar(dir);
    const field = input.closest('[data-slot="date-picker-field"]') ?? input;
    const popup = screen.getByRole('dialog').element();
    await waitForPopupSide({ dir, trigger: field, popup, side: 'bottom', align: 'start' });
  });

  it('is Gregorian, starts the week on Saturday and names the month in the reading language', async () => {
    const { screen } = await openCalendar(dir);
    const heading = dir === 'rtl' ? 'تشرين الثاني 2026' : 'November 2026';
    await expect.element(screen.getByText(heading)).toBeVisible();
    const headers = screen.getByRole('columnheader').elements();
    expect(headers).toHaveLength(7);
    const firstHeader = headers[0];
    const name =
      firstHeader?.getAttribute('aria-label') ??
      firstHeader?.getAttribute('abbr') ??
      firstHeader?.textContent;
    expect(name).toBe(dir === 'rtl' ? 'السبت' : 'Saturday');
  });

  it('focuses the chosen day; arrows follow the reading direction; Down is a week; Page Down a month', async () => {
    const { screen } = await openCalendar(dir);
    await poll(focusedDay, 'focus on the chosen day').toBe('24');
    await userEvent.keyboard(`{${arrows(dir).forward}}`);
    await poll(focusedDay, 'forward is the next day').toBe('25');
    await userEvent.keyboard(`{${arrows(dir).backward}}`);
    await poll(focusedDay, 'backward is the day before').toBe('24');
    await userEvent.keyboard('{ArrowDown}');
    await poll(focusedDay, 'down is a week later').toBe('1');
    await userEvent.keyboard('{PageDown}');
    const next = dir === 'rtl' ? 'كانون الثاني 2027' : 'January 2027';
    await expect.element(screen.getByText(next)).toBeVisible();
  });

  it('days before the minimum are disabled', async () => {
    const { screen } = await openCalendar(dir);
    const day19 = screen
      .getByRole('gridcell')
      .elements()
      .find((c) => c.textContent.trim() === '19' && !c.closest('[data-outside-month]'));
    const target = day19?.querySelector('button') ?? day19;
    expect(
      target?.getAttribute('aria-disabled') === 'true' ||
        (target as HTMLButtonElement | undefined)?.disabled,
    ).toBe(true);
  });

  it('Enter chooses the day, closes the calendar and returns focus to its button', async () => {
    const { screen, input, button, onValueChange } = await openCalendar(dir);
    await poll(focusedDay, 'on 24').toBe('24');
    await userEvent.keyboard(`{${arrows(dir).forward}}{Enter}`);
    expect(onValueChange).toHaveBeenLastCalledWith('2026-11-25');
    await expect.element(screen.getByRole('grid')).not.toBeInTheDocument();
    expect(shown(input)).toBe('25/11/2026');
    await poll(() => document.activeElement, 'focus back on the button').toBe(button);
  });

  it('Escape closes the calendar, keeps the date and returns focus to its button', async () => {
    const { screen, input, button, onValueChange } = await openCalendar(dir);
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('grid')).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(shown(input)).toBe('24/11/2026');
    await poll(() => document.activeElement, 'focus back on the button').toBe(button);
  });

  it('an error marks the field and is read with it', async () => {
    const { input } = await setup(dir, { error: 'اختر تاريخاً من اليوم فصاعداً' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ')).toContain(
      'اختر تاريخاً من اليوم فصاعداً',
    );
  });

  it('is clean under axe, closed and open, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <DatePicker label="تاريخ الموعد" defaultValue="2026-11-24" min="2026-11-20" />,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await userEvent.click(screen.getByRole('button', { name: OPEN[dir] }));
      await expect.element(screen.getByRole('grid')).toBeVisible();
      await expectAxeClean(screen.container);
      await userEvent.keyboard('{Escape}');
      await screen.unmount();
    }
  });
});
