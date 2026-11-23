// Segments and calendar in sync (slice 0.4-13 criteria 16 and 17, OD-72): a typed date opens the
// calendar on its month; a chosen day fills the segments; a value set from outside fills them;
// a complete date shows its weekday and Levantine month under the field, read with it, and the
// age with `showAge`.
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { arrows, renderDir } from '../../test/support/index.ts';
import { DensityProvider, DirectionProvider, ThemeProvider } from '../index.ts';
import { DatePicker } from './date-picker.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const LABEL = 'تاريخ الموعد';
const NAMES = {
  rtl: { day: 'اليوم', month: 'الشهر', year: 'السنة' },
  ltr: { day: 'Day', month: 'Month', year: 'Year' },
} as const;

/** `ui` inside the same providers `renderDir` draws, so a rerender updates the field in place. */
const inRegion = (ui: ReactNode, dir: 'rtl' | 'ltr') => (
  <DirectionProvider dir={dir}>
    <ThemeProvider theme="light">
      <DensityProvider density="comfortable">
        <div className="bg-bg-app font-ui text-text-default">{ui}</div>
      </DensityProvider>
    </ThemeProvider>
  </DirectionProvider>
);

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });
const described = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

async function setup(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof DatePicker>[0]> = {}) {
  const onValueChange = vi.fn<(value: string | null) => void>();
  const screen = await renderDir(
    <div className="flex justify-center p-16">
      <DatePicker label={LABEL} onValueChange={onValueChange} {...props} />
    </div>,
    { dir },
  );
  const get = (unit: 'day' | 'month' | 'year') =>
    screen.getByRole('spinbutton', { name: NAMES[dir][unit] }).element() as HTMLInputElement;
  return {
    screen,
    group: screen.getByRole('group', { name: LABEL }).element() as HTMLElement,
    day: get('day'),
    month: get('month'),
    year: get('year'),
    button: screen.getByRole('button', { name: 'فتح التقويم' }).element() as HTMLElement,
    onValueChange,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe.each(DIRS)('Date Picker sync in %s', (dir) => {
  it('a typed date opens the calendar on its month', async () => {
    const s = await setup(dir, { defaultValue: '2026-11-24' });
    s.day.focus();
    await userEvent.keyboard('{Backspace}{Backspace}');
    s.day.focus();
    await userEvent.keyboard('14031987');
    await poll(() => s.onValueChange.mock.lastCall?.[0], 'typed').toBe('1987-03-14');
    await userEvent.click(s.button);
    const heading = dir === 'rtl' ? 'آذار 1987' : 'March 1987';
    await expect.element(s.screen.getByText(heading)).toBeVisible();
    await poll(() => document.activeElement?.textContent.trim(), 'focus on the 14th').toBe('14');
  });

  it('a chosen day fills the segments', async () => {
    const s = await setup(dir, { defaultValue: '2026-11-24' });
    await userEvent.click(s.button);
    await expect.element(s.screen.getByRole('grid')).toBeVisible();
    await poll(() => document.activeElement?.textContent.trim(), 'on 24').toBe('24');
    await userEvent.keyboard(`{${arrows(dir).forward}}{Enter}`);
    expect(s.onValueChange).toHaveBeenLastCalledWith('2026-11-25');
    await poll(() => [s.day.value, s.month.value, s.year.value], 'segments follow').toEqual([
      '25',
      '11',
      '2026',
    ]);
  });

  it('a value set from outside fills the segments; null clears them', async () => {
    const s = await setup(dir, { value: '1987-03-14' });
    expect([s.day.value, s.month.value, s.year.value]).toEqual(['14', '03', '1987']);
    await s.screen.rerender(
      inRegion(
        <div className="flex justify-center p-16">
          <DatePicker label={LABEL} value="2001-02-03" />
        </div>,
        dir,
      ),
    );
    await poll(() => [s.day.value, s.month.value, s.year.value], 'new value').toEqual([
      '03',
      '02',
      '2001',
    ]);
    await s.screen.rerender(
      inRegion(
        <div className="flex justify-center p-16">
          <DatePicker label={LABEL} value={null} />
        </div>,
        dir,
      ),
    );
    await poll(() => [s.day.value, s.month.value, s.year.value], 'cleared').toEqual(['', '', '']);
  });

  it('a complete date shows its weekday and month under the field, read with it', async () => {
    const s = await setup(dir, { hint: 'يوم/شهر/سنة' });
    s.day.focus();
    await userEvent.keyboard('14031987');
    const line = dir === 'rtl' ? 'السبت 14 آذار 1987' : 'Saturday 14 March 1987';
    await poll(() => described(s.group), 'the weekday line').toContain(line);
    expect(described(s.group)).not.toContain('سنة ·');
  });

  it('showAge adds the age to the line', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 23, 12));
    const s = await setup(dir, { showAge: true, defaultValue: '1987-03-14' });
    const line =
      dir === 'rtl' ? 'السبت 14 آذار 1987 · 39 سنة' : 'Saturday 14 March 1987 · 39 years';
    await poll(() => described(s.group), 'the line with the age').toContain(line);
  });
});
