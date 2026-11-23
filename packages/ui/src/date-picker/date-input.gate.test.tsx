// UI SDK `DateInput` RTL gate (spec 0.4 follow-up criterion 18, slice 0.4-13 checkpoint 1).
// Before the Date Picker's typed date is built on UI SDK's `DateInput`, this proves, in Arabic RTL
// and English LTR, what our wrapper will rely on: explicit `DateInputSegment` children in the
// order day / month / year (forced by us, not taken from the locale), left to right in both
// directions (`dir="ltr"` on the group, as Time Input); Arabic names and placeholders on the
// segments; Left and Right move to the segment on that side; Up/Down step and wrap; «4» moves on;
// `/`, `-`, `.` and space move on; Backspace in an empty segment goes back; four paste formats;
// Arabic-Indic digits (through `useArabicIndicKeys`); an ISO value that is null until complete;
// the partial state readable from `state.segments`; a two-digit year never expanded.
import { DateInput, DateInputSegment } from '@ui-sdk/react/date-input';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderDir } from '../../test/support/index.ts';
import { useArabicIndicKeys } from '../lib/use-arabic-indic-keys.ts';
import { useDirection } from '../providers/direction-provider.tsx';
import { DATE_LOCALE } from './date-picker.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const ORDER = ['day', 'month', 'year'] as const;
type Unit = (typeof ORDER)[number];
const NAMES = {
  rtl: { day: 'اليوم', month: 'الشهر', year: 'السنة' },
  ltr: { day: 'Day', month: 'Month', year: 'Year' },
} as const;
const PLACEHOLDERS = {
  rtl: { day: 'يوم', month: 'شهر', year: 'سنة' },
  ltr: { day: 'Day', month: 'Month', year: 'Year' },
} as const;

interface SegmentData {
  key: string;
  type: string;
  empty: boolean;
  editable: boolean;
}

interface GateProps {
  defaultValue?: string;
  locale?: string;
  onValueChange?: (value: string | null) => void;
  onSegments?: (empty: Record<Unit, boolean>) => void;
}

/** The smallest wrapper checkpoint 2 will build: forced order, names, placeholders, OD-20. */
function GateDateInput({ defaultValue, locale, onValueChange, onSegments }: GateProps) {
  const dir = useDirection();
  const arabicIndicKeys = useArabicIndicKeys();
  return (
    <DateInput
      ref={arabicIndicKeys}
      dir="ltr"
      aria-label={dir === 'rtl' ? 'تاريخ الميلاد' : 'Birth date'}
      locale={locale ?? DATE_LOCALE[dir]}
      {...(defaultValue === undefined ? {} : { defaultValue })}
      {...(onValueChange === undefined
        ? {}
        : {
            onValueChange: (next: string | null) => {
              onValueChange(next);
            },
          })}
      className="flex items-center gap-1"
    >
      {(state: { segments: SegmentData[] }) => {
        const byType = new Map(state.segments.map((s) => [s.type, s]));
        onSegments?.({
          day: byType.get('day')?.empty ?? true,
          month: byType.get('month')?.empty ?? true,
          year: byType.get('year')?.empty ?? true,
        });
        // Our order, whatever the locale's: day / month / year with our own separators.
        return ORDER.flatMap((unit, index) => {
          const segment = byType.get(unit);
          if (segment === undefined) return [];
          const input = (
            <DateInputSegment
              key={unit}
              segment={segment as never}
              aria-label={NAMES[dir][unit]}
              // UI SDK writes its own placeholder («––») over a `placeholder` prop; an element
              // given to `render` keeps its own props over UI SDK's (wrapper fix).
              render={<input placeholder={PLACEHOLDERS[dir][unit]} />}
            />
          );
          return index === 0
            ? [input]
            : [
                <span key={`sep-${unit}`} aria-hidden="true">
                  /
                </span>,
                input,
              ];
        });
      }}
    </DateInput>
  );
}

async function setup(dir: 'rtl' | 'ltr', props: GateProps = {}) {
  const onValueChange = vi.fn<(value: string | null) => void>();
  const segments: Record<Unit, boolean>[] = [];
  const screen = await renderDir(
    <div className="p-8">
      <GateDateInput
        onValueChange={onValueChange}
        onSegments={(empty) => segments.push(empty)}
        {...props}
      />
    </div>,
    { dir },
  );
  const get = (unit: Unit) =>
    screen.getByRole('spinbutton', { name: NAMES[dir][unit] }).element() as HTMLInputElement;
  return {
    screen,
    day: get('day'),
    month: get('month'),
    year: get('year'),
    onValueChange,
    lastSegments: () => segments.at(-1),
  };
}

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });
const lastValue = (fn: ReturnType<typeof vi.fn>) => fn.mock.lastCall?.[0] as string | null;

function paste(target: HTMLElement, text: string) {
  const data = new DataTransfer();
  data.setData('text/plain', text);
  target.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
  );
}

describe.each(DIRS)('UI SDK DateInput gate in %s', (dir) => {
  it('renders day, month and year left to right, named, with placeholders', async () => {
    const { day, month, year } = await setup(dir);
    const x = (el: Element) => el.getBoundingClientRect().left;
    expect(x(day)).toBeLessThan(x(month));
    expect(x(month)).toBeLessThan(x(year));
    expect(day.placeholder).toBe(PLACEHOLDERS[dir].day);
    expect(month.placeholder).toBe(PLACEHOLDERS[dir].month);
    expect(year.placeholder).toBe(PLACEHOLDERS[dir].year);
  });

  it('keeps our order under a locale that writes the month first (en-US)', async () => {
    const { day, month, year, onValueChange } = await setup(dir, { locale: 'en-US' });
    const x = (el: Element) => el.getBoundingClientRect().left;
    expect(x(day)).toBeLessThan(x(month));
    expect(x(month)).toBeLessThan(x(year));
    day.focus();
    await userEvent.keyboard('14031987');
    await poll(() => lastValue(onValueChange), 'typed in our order').toBe('1987-03-14');
  });

  it('Right goes to the segment on the right, Left back', async () => {
    const { day, month } = await setup(dir, { defaultValue: '1987-03-14' });
    day.focus();
    await userEvent.keyboard('{ArrowRight}');
    await poll(() => document.activeElement, 'Right reaches the month').toBe(month);
    await userEvent.keyboard('{ArrowLeft}');
    await poll(() => document.activeElement, 'Left comes back to the day').toBe(day);
  });

  it('Up and Down step the segment and wrap', async () => {
    const { month, onValueChange } = await setup(dir, { defaultValue: '1987-12-14' });
    month.focus();
    await userEvent.keyboard('{ArrowUp}');
    await poll(() => lastValue(onValueChange), 'December up wraps to January').toBe('1987-01-14');
    await userEvent.keyboard('{ArrowDown}');
    await poll(() => lastValue(onValueChange), 'January down wraps to December').toBe('1987-12-14');
  });

  it('types 14031987 into a full ISO date, null until the year is complete', async () => {
    const { day, onValueChange, lastSegments } = await setup(dir);
    day.focus();
    await userEvent.keyboard('1403');
    expect(onValueChange).not.toHaveBeenCalled();
    // The partial state for «السنة ناقصة»: which segments are empty.
    await poll(lastSegments, 'the year is still empty').toEqual({
      day: false,
      month: false,
      year: true,
    });
    await userEvent.keyboard('1987');
    await poll(() => lastValue(onValueChange), 'complete date').toBe('1987-03-14');
  });

  it('a digit that cannot start a two-digit value moves on: «4» → 04', async () => {
    const { day, month } = await setup(dir);
    day.focus();
    await userEvent.keyboard('4');
    await poll(() => document.activeElement, 'on to the month').toBe(month);
    expect(day.value).toBe('04');
  });

  it.each(['/', '-', '.', ' '])('the separator «%s» moves on', async (separator) => {
    const { day, onValueChange } = await setup(dir);
    day.focus();
    await userEvent.keyboard(`1${separator}3${separator}1987`);
    await poll(() => lastValue(onValueChange), `1${separator}3${separator}1987`).toBe('1987-03-01');
  });

  it('Backspace in an empty segment goes back', async () => {
    const { day, month } = await setup(dir);
    day.focus();
    await userEvent.keyboard('14');
    await poll(() => document.activeElement, 'on the month').toBe(month);
    await userEvent.keyboard('{Backspace}');
    await poll(() => document.activeElement, 'back on the day').toBe(day);
  });

  it.each(['14/03/1987', '14-3-1987', '14.3.1987', '1987-03-14'])(
    'pasting %s into any segment fills all three',
    async (text) => {
      for (const unit of ORDER) {
        const s = await setup(dir);
        s[unit].focus();
        paste(s[unit], text);
        await poll(() => lastValue(s.onValueChange), `${text} into the ${unit}`).toBe('1987-03-14');
        expect([s.day.value, s.month.value, s.year.value]).toEqual(['14', '03', '1987']);
        await s.screen.unmount();
      }
    },
  );

  it('accepts typed Arabic-Indic digits and shows Western ones', async () => {
    const { day, month, year, onValueChange } = await setup(dir);
    day.focus();
    await userEvent.keyboard('١٤٠٣١٩٨٧');
    await poll(() => lastValue(onValueChange), 'Arabic-Indic date').toBe('1987-03-14');
    expect([day.value, month.value, year.value]).toEqual(['14', '03', '1987']);
  });

  it('a pasted Arabic-Indic date fills all three', async () => {
    const { year, onValueChange } = await setup(dir);
    year.focus();
    paste(year, '١٤/٠٣/١٩٨٧');
    await poll(() => lastValue(onValueChange), 'pasted Arabic-Indic date').toBe('1987-03-14');
  });

  it('a typed two-digit year is not expanded to 19xx or 20xx', async () => {
    const { day, onValueChange } = await setup(dir);
    day.focus();
    await userEvent.keyboard('140387');
    await userEvent.tab();
    await poll(() => onValueChange.mock.calls.length, 'blur settles the year').toBeGreaterThan(0);
    expect(lastValue(onValueChange) ?? '').not.toMatch(/^(19|20)87/);
  });

  // UI SDK's paste parser expands a two-digit year (`fullYear` in core's date/parse). Our wrapper
  // must catch the paste first (checkpoint 2, `parse-date.ts`); this records the SDK's behaviour.
  it.fails('a pasted two-digit year is not expanded (UI SDK expands it)', async () => {
    const { day, onValueChange } = await setup(dir);
    day.focus();
    paste(day, '14/03/87');
    await poll(() => onValueChange.mock.calls.length, 'the paste is read').toBeGreaterThan(0);
    expect(lastValue(onValueChange) ?? '').not.toMatch(/^(19|20)87/);
  });
});
