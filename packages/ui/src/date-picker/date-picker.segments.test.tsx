// Date Picker typed entry (slice 0.4-13 criteria 15 and 16, OD-69 A, OD-72): three named
// spinbuttons day / month / year, left to right in both directions, with placeholders; «4»
// moves on; `/`, `-`, `.` and a space move on; Backspace in an empty segment goes back; Up and
// Down step; Arabic-Indic digits become Western; four paste formats; an ISO value; autocomplete
// off unless a FormField names `bday`. Errors show on leaving the field, or at once for an
// impossible date, and an `error` from the form wins.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir } from '../../test/support/index.ts';
import { FieldAutoCompleteContext } from '../field/field-shell.tsx';
import { DatePicker } from './date-picker.tsx';

const DIRS = ['rtl', 'ltr'] as const;
type Unit = 'day' | 'month' | 'year';
const NAMES = {
  rtl: { day: 'اليوم', month: 'الشهر', year: 'السنة' },
  ltr: { day: 'Day', month: 'Month', year: 'Year' },
} as const;
const PLACEHOLDERS = {
  rtl: { day: 'يوم', month: 'شهر', year: 'سنة' },
  ltr: { day: 'dd', month: 'mm', year: 'yyyy' },
} as const;
const LABEL = 'تاريخ الميلاد';

type Props = Partial<Parameters<typeof DatePicker>[0]>;

async function setup(dir: 'rtl' | 'ltr', props: Props = {}) {
  const onValueChange = vi.fn<(value: string | null) => void>();
  const screen = await renderDir(
    <div className="flex flex-col gap-4 p-8">
      <DatePicker label={LABEL} onValueChange={onValueChange} {...props} />
      <button type="button">بعده</button>
    </div>,
    { dir },
  );
  const group = screen.getByRole('group', { name: LABEL }).element() as HTMLElement;
  const get = (unit: Unit) =>
    screen.getByRole('spinbutton', { name: NAMES[dir][unit] }).element() as HTMLInputElement;
  return { screen, group, day: get('day'), month: get('month'), year: get('year'), onValueChange };
}

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });
const lastValue = (fn: ReturnType<typeof vi.fn>) => fn.mock.lastCall?.[0] as string | null;
const texts = (s: { day: HTMLInputElement; month: HTMLInputElement; year: HTMLInputElement }) => [
  s.day.value,
  s.month.value,
  s.year.value,
];
const described = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

/** Leaves the field for the button after it, as a person moves on. */
async function leave(screen: Awaited<ReturnType<typeof renderDir>>) {
  await userEvent.click(screen.getByRole('button', { name: 'بعده' }));
}

function paste(target: HTMLElement, text: string) {
  const data = new DataTransfer();
  data.setData('text/plain', text);
  target.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
  );
}

describe.each(DIRS)('Date Picker segments in %s', (dir) => {
  it('is a group of day, month and year, left to right, named, with placeholders', async () => {
    const s = await setup(dir);
    const x = (el: Element) => el.getBoundingClientRect().left;
    expect(x(s.day)).toBeLessThan(x(s.month));
    expect(x(s.month)).toBeLessThan(x(s.year));
    for (const unit of ['day', 'month', 'year'] as const) {
      expect(s[unit].placeholder).toBe(PLACEHOLDERS[dir][unit]);
      expect(s[unit].inputMode).toBe('numeric');
    }
    // The calendar button stays at the logical end of the box.
    const button = s.screen.getByRole('button', { name: 'فتح التقويم' }).element();
    const after = dir === 'rtl' ? x(button) < x(s.day) : x(button) > x(s.year);
    expect(after).toBe(true);
  });

  it('types 14031987 into 14/03/1987 and reports the ISO date once complete', async () => {
    const s = await setup(dir);
    s.day.focus();
    await userEvent.keyboard('1403');
    expect(s.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('1987');
    await poll(() => lastValue(s.onValueChange), 'complete date').toBe('1987-03-14');
    expect(texts(s)).toEqual(['14', '03', '1987']);
    expect(s.day.getAttribute('aria-valuenow')).toBe('14');
  });

  it('«4» moves on to the month as 04', async () => {
    const s = await setup(dir);
    s.day.focus();
    await userEvent.keyboard('4');
    await poll(() => document.activeElement, 'on the month').toBe(s.month);
    expect(s.day.value).toBe('04');
  });

  it.each(['/', '-', '.', ' '])('the separator «%s» moves on', async (separator) => {
    const s = await setup(dir);
    s.day.focus();
    await userEvent.keyboard(`1${separator}3${separator}1987`);
    await poll(() => lastValue(s.onValueChange), 'date with separators').toBe('1987-03-01');
    expect(texts(s)).toEqual(['01', '03', '1987']);
  });

  it('Backspace empties a segment, then goes back', async () => {
    const s = await setup(dir, { defaultValue: '1987-03-14' });
    s.month.focus();
    await userEvent.keyboard('{Backspace}');
    expect(s.month.value).toBe('');
    await poll(() => lastValue(s.onValueChange), 'the value is gone').toBeNull();
    await userEvent.keyboard('{Backspace}');
    await poll(() => document.activeElement, 'back on the day').toBe(s.day);
  });

  it('Right goes to the segment on the right, Left back', async () => {
    const s = await setup(dir, { defaultValue: '1987-03-14' });
    s.day.focus();
    await userEvent.keyboard('{ArrowRight}');
    await poll(() => document.activeElement, 'Right reaches the month').toBe(s.month);
    await userEvent.keyboard('{ArrowLeft}');
    await poll(() => document.activeElement, 'Left returns to the day').toBe(s.day);
  });

  it('Up and Down step and wrap', async () => {
    const s = await setup(dir, { defaultValue: '1987-12-14' });
    s.month.focus();
    await userEvent.keyboard('{ArrowUp}');
    await poll(() => lastValue(s.onValueChange), 'December up is January').toBe('1987-01-14');
    await userEvent.keyboard('{ArrowDown}');
    await poll(() => lastValue(s.onValueChange), 'and back').toBe('1987-12-14');
  });

  it('accepts Arabic-Indic digits and shows Western ones', async () => {
    const s = await setup(dir);
    s.day.focus();
    await userEvent.keyboard('١٤٠٣١٩٨٧');
    await poll(() => lastValue(s.onValueChange), 'Arabic-Indic date').toBe('1987-03-14');
    expect(texts(s)).toEqual(['14', '03', '1987']);
  });

  it.each(['14/03/1987', '14-3-1987', '14.3.1987', '1987-03-14', '١٤/٠٣/١٩٨٧'])(
    'pasting %s into any segment fills all three',
    async (text) => {
      for (const unit of ['day', 'month', 'year'] as const) {
        const s = await setup(dir);
        s[unit].focus();
        paste(s[unit], text);
        await poll(() => lastValue(s.onValueChange), `${text} into the ${unit}`).toBe('1987-03-14');
        expect(texts(s)).toEqual(['14', '03', '1987']);
        await s.screen.unmount();
      }
    },
  );

  it('autocomplete is off, and bday parts inside a FormField that names bday', async () => {
    const off = await setup(dir);
    expect([off.day, off.month, off.year].map((el) => el.autocomplete)).toEqual([
      'off',
      'off',
      'off',
    ]);
    await off.screen.unmount();
    const screen = await renderDir(
      <FieldAutoCompleteContext value="bday">
        <DatePicker label={LABEL} />
      </FieldAutoCompleteContext>,
      { dir },
    );
    const tokens = (['day', 'month', 'year'] as const).map(
      (unit) =>
        (screen.getByRole('spinbutton', { name: NAMES[dir][unit] }).element() as HTMLInputElement)
          .autocomplete,
    );
    expect(tokens).toEqual(['bday-day', 'bday-month', 'bday-year']);
  });

  it('a missing year is named when the field is left, not while typing', async () => {
    const s = await setup(dir);
    s.day.focus();
    await userEvent.keyboard('1403');
    expect(s.group.getAttribute('aria-invalid')).not.toBe('true');
    await leave(s.screen);
    const text =
      dir === 'rtl' ? 'أكمل التاريخ: السنة ناقصة' : 'Complete the date: the year is missing';
    await poll(() => described(s.group), 'the error is read with the group').toContain(text);
    expect(s.group.getAttribute('aria-invalid')).toBe('true');
  });

  it('an impossible date is named at once and keeps the typed day', async () => {
    const s = await setup(dir);
    s.day.focus();
    await userEvent.keyboard('31021987');
    const text = dir === 'rtl' ? 'شباط 1987 فيه 28 يوماً' : 'February 1987 has 28 days';
    await poll(() => described(s.group), 'shown before leaving').toContain(text);
    expect(texts(s)).toEqual(['31', '02', '1987']);
    expect(s.onValueChange).not.toHaveBeenCalledWith('1987-02-28');
  });

  it('a two-digit year is kept and asked again in four digits', async () => {
    const s = await setup(dir);
    s.day.focus();
    paste(s.day, '14/03/87');
    await leave(s.screen);
    const text =
      dir === 'rtl' ? 'اكتب السنة بأربعة أرقام: 1987' : 'Write the year with four digits: 1987';
    await poll(() => described(s.group), 'four digits asked').toContain(text);
    expect(s.year.value).toBe('87');
    expect(s.onValueChange.mock.calls.flat()).not.toContain('1987-03-14');
  });

  it('a date after max shows maxMessage', async () => {
    const s = await setup(dir, {
      max: '2026-11-23',
      maxMessage: 'تاريخ الميلاد لا يكون بعد اليوم',
    });
    s.day.focus();
    await userEvent.keyboard('02012027');
    await leave(s.screen);
    await poll(() => described(s.group), 'max message').toContain(
      'تاريخ الميلاد لا يكون بعد اليوم',
    );
  });

  it('an error from the form wins over the typed-date error', async () => {
    const s = await setup(dir, { error: 'هذا الحقل مطلوب' });
    s.day.focus();
    await userEvent.keyboard('1403');
    await leave(s.screen);
    await poll(() => described(s.group), 'the form error').toContain('هذا الحقل مطلوب');
    expect(described(s.group)).not.toContain('ناقصة');
    expect(described(s.group)).not.toContain('missing');
  });

  it('a disabled field cannot be focused or typed in', async () => {
    const s = await setup(dir, { disabled: true, defaultValue: '2025-02-03' });
    expect([s.day.disabled, s.month.disabled, s.year.disabled]).toEqual([true, true, true]);
    expect(texts(s)).toEqual(['03', '02', '2025']);
  });

  it('is clean under axe, empty, filled and with an error, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const props of [{}, { defaultValue: '1987-03-14' }, { error: 'هذا الحقل مطلوب' }]) {
        const screen = await renderDir(<DatePicker label={LABEL} {...props} />, { dir, theme });
        await expectAxeClean(screen.container);
        await screen.unmount();
      }
    }
  });
});
