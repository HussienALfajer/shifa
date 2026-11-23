// The Date Picker's month and year panel (slice 0.4-13 criterion 14, OD-68 B), as the owner
// approved the sheet on 2026-11-23 ("Shifa Components (proposals)", page "Before Phase A ·
// 0.4-12 and 0.4-13", board "Date Picker · quick month and year", option B): one panel inside
// the calendar's popover, a year list at the logical start (96 px, scrolling in 240 px, a line at
// its inline end) beside a 3 × 4 grid of Levantine month names (OD-61), and «هذا الشهر» below.
//
// The year list is UI SDK's Listbox: Up/Down a year, Page Up/Down ten, Home/End the ends, typed
// digits jump to a year («198» to the eighties), the selection follows focus; Enter goes on to
// the months. The month grid is a grid of buttons with one tab stop: arrows follow the reading
// direction, Up/Down three months, Enter or a press chooses. Months outside min/max are
// aria-disabled, still read and focusable, never chosen. Escape steps back (months → years →
// days); the Date Picker keeps the popover open meanwhile.
import { Field } from '@ui-sdk/react/field';
import { Listbox, ListboxItem } from '@ui-sdk/react/listbox';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn.ts';
import type { Direction } from '../providers/direction-provider.tsx';
import { monthName } from './date-text.ts';
import { type Bounds, isMonthDisabled, isoMonth, yearRange } from './month-year.ts';

const LABELS = {
  rtl: { years: 'السنة', months: 'الشهر', thisMonth: 'هذا الشهر' },
  ltr: { years: 'Year', months: 'Month', thisMonth: 'This month' },
} as const;

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const ROWS = [0, 1, 2, 3];
const COLUMNS = 3;

const CHOICE = cn(
  'cursor-pointer rounded-control border-0 bg-transparent font-ui text-250 font-medium leading-heading tabular-nums text-text-default',
  'hover:bg-selection-subtle',
  'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
  'aria-selected:bg-brand-primary aria-selected:font-semibold aria-selected:text-brand-on-primary',
  'aria-disabled:cursor-not-allowed aria-disabled:bg-transparent aria-disabled:text-text-disabled',
);

export interface MonthYearPanelProps extends Bounds {
  id: string;
  dir: Direction;
  /** The month the calendar shows («2026-11»). */
  month: string;
  /** The chosen date's month, marked in the grid, if any. */
  selectedMonth: string | null;
  todayYear: number;
  /** A month was chosen: show its days. */
  onChoose: (month: string) => void;
  /** «هذا الشهر». */
  onThisMonth: () => void;
  /** Escape in the year list: back to the days. */
  onBack: () => void;
}

export function MonthYearPanel({
  id,
  dir,
  month,
  selectedMonth,
  todayYear,
  min,
  max,
  onChoose,
  onThisMonth,
  onBack,
}: MonthYearPanelProps) {
  const labels = LABELS[dir];
  const { first, last } = yearRange({ min, max, todayYear });
  const shownYear = Number(month.slice(0, 4));
  const [year, setYear] = useState(() => Math.min(Math.max(shownYear, first), last));
  const [focusMonth, setFocusMonth] = useState(() => Number(month.slice(5, 7)));
  const years = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const listRef = useRef<HTMLDivElement | null>(null);
  const monthRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusYear = () => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  };
  // The panel opens on the shown year, focused and scrolled into view.
  useEffect(() => {
    focusYear();
  }, []);

  const focusMonthAt = (next: number) => {
    const target = Math.min(Math.max(next, 1), 12);
    setFocusMonth(target);
    monthRefs.current[target - 1]?.focus();
  };

  function onYearKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      focusMonthAt(focusMonth);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onBack();
    }
  }

  function onMonthKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const moves: Record<string, number> = {
      [forward]: 1,
      [backward]: -1,
      ArrowDown: COLUMNS,
      ArrowUp: -COLUMNS,
    };
    const step = moves[event.key];
    if (step !== undefined) {
      event.preventDefault();
      focusMonthAt(current + step);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusMonthAt(event.key === 'Home' ? 1 : 12);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      focusYear();
    }
  }

  return (
    <div id={id} data-slot="month-year-panel" className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div
          data-slot="year-scroll"
          className="h-(--shifa-size-year-list-height) w-(--shifa-size-year-list-width) shrink-0 overflow-y-auto border-e border-border-default pe-2"
        >
          {/* A Field of its own: UI SDK's Listbox joins the nearest Field, which would name it by
              the date's label and take that Field's control from the segments. */}
          <Field className="contents">
            <Listbox
              ref={listRef}
              aria-label={labels.years}
              activation="automatic"
              value={String(year)}
              onValueChange={(next: unknown) => {
                if (typeof next === 'string') setYear(Number(next));
              }}
              onKeyDown={onYearKeyDown}
              className="flex flex-col gap-0.5 outline-none"
            >
              {years.map((value) => (
                <ListboxItem
                  key={value}
                  value={String(value)}
                  onClick={() => {
                    focusMonthAt(focusMonth);
                  }}
                  className={cn(CHOICE, 'flex h-10 shrink-0 items-center justify-center')}
                >
                  {String(value)}
                </ListboxItem>
              ))}
            </Listbox>
          </Field>
        </div>
        <div role="grid" aria-label={labels.months} className="flex flex-1 flex-col gap-2">
          {ROWS.map((row) => (
            // biome-ignore lint/a11y/useFocusableInteractive: a grid row holds the focusable cells
            <div key={row} role="row" className="grid grid-cols-3 gap-2">
              {MONTHS.slice(row * COLUMNS, row * COLUMNS + COLUMNS).map((m) => {
                const disabled = isMonthDisabled(year, m, { min, max });
                const key = isoMonth(year, m);
                return (
                  <div key={m} role="gridcell" aria-selected={key === selectedMonth}>
                    <button
                      ref={(el) => {
                        monthRefs.current[m - 1] = el;
                      }}
                      type="button"
                      tabIndex={m === focusMonth ? 0 : -1}
                      {...(disabled ? { 'aria-disabled': true } : {})}
                      {...(key === selectedMonth ? { 'aria-current': 'date' as const } : {})}
                      onFocus={() => {
                        setFocusMonth(m);
                      }}
                      onKeyDown={(event) => {
                        onMonthKeyDown(event, m);
                      }}
                      onClick={() => {
                        if (!disabled) onChoose(key);
                      }}
                      className={cn(
                        CHOICE,
                        'h-(--shifa-size-control-lg) w-full px-1 text-200',
                        key === selectedMonth &&
                          !disabled &&
                          'bg-brand-primary font-semibold text-brand-on-primary hover:bg-brand-primary',
                      )}
                    >
                      {monthName(m, dir)}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center border-t border-border-default pt-2">
        <button
          type="button"
          onClick={onThisMonth}
          className={cn(
            'h-(--shifa-size-control-sm) cursor-pointer rounded-control border-0 bg-transparent px-3',
            'font-ui text-200 font-medium leading-heading text-brand-primary hover:bg-selection-subtle',
            'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-border-focus',
          )}
        >
          {labels.thisMonth}
        </button>
      </div>
    </div>
  );
}
