// Date Picker (slice 0.4-04), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Gate components · 0.4-04"), with OD-61: Gregorian, the week starting on
// Saturday, Levantine month names in Arabic (تشرين الثاني), dates as dd/mm/yyyy in Western
// digits. A field with a calendar button at its logical end; the calendar below it, starting at
// its logical edge; today ringed in green, the chosen day filled green, days out of range muted.
// Behaviour from UI SDK's Date Picker: arrows in the grid follow the reading direction, Page Up
// and Page Down by month, Enter chooses and focus returns to the calendar button.
// Since slice 0.4-13 (OD-69 A, OD-72) the date is typed in three segments day / month / year
// (`date-segments.tsx`, our own model), with Arabic errors and a confirmation line under the
// field (`use-date-entry.ts`); segments and calendar share one value and one month.
import {
  DatePicker as BaseDatePicker,
  CalendarDay,
  CalendarGrid,
  CalendarHeading,
  CalendarNext,
  CalendarPrevious,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
  DatePickerContent,
  DatePickerTrigger,
} from '@ui-sdk/react/date-picker';
import { type ReactNode, useState } from 'react';
import { FIELD_BOX, FieldShell, hasError, useFieldAutoComplete } from '../field/field-shell.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { FLOATING_BOX } from '../popover/popover.tsx';
import { useDirection } from '../providers/direction-provider.tsx';
import { DATE_LOCALE } from './date-locale.ts';
import { DateSegments } from './date-segments.tsx';
import { useDateEntry } from './use-date-entry.ts';

export { DATE_LOCALE };

/** Saturday, in UI SDK's numbering (0 is Sunday): the Syrian week (OD-61). */
const SATURDAY = 6;

const LABELS = {
  rtl: {
    open: 'فتح التقويم',
    calendar: 'اختيار التاريخ',
    previous: 'الشهر السابق',
    next: 'الشهر التالي',
  },
  ltr: {
    open: 'فتح التقويم',
    calendar: 'Choose a date',
    previous: 'Previous month',
    next: 'Next month',
  },
} as const;

export interface DatePickerProps {
  label: ReactNode;
  /** An ISO date («2026-11-24»), with no time or time zone. */
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  onValueChange?: ((value: string | null) => void) | undefined;
  /** The first date that can be chosen (ISO); earlier days are disabled. */
  min?: string | undefined;
  max?: string | undefined;
  /** Said for a typed date after `max` instead of «اختر تاريخاً حتى …», such as «تاريخ الميلاد لا يكون بعد اليوم». */
  maxMessage?: string | undefined;
  /** Adds the age to the line under a complete date («· 39 سنة»): for birth dates (OD-72). */
  showAge?: boolean | undefined;
  /** The name of the calendar button, for screen readers (Arabic by default in both languages). */
  openLabel?: string | undefined;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  name?: string | undefined;
  className?: string | undefined;
}

const NAV = cn(
  'inline-flex size-(--shifa-size-control-sm) cursor-pointer items-center justify-center rounded-control border-0',
  'bg-transparent text-text-default hover:bg-selection-subtle',
  'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-border-focus',
  'data-disabled:cursor-not-allowed data-disabled:text-text-disabled',
);

// The day cells are table cells (UI SDK draws a real <table>): sized and rounded as cells, never
// given a flex display, which would take them out of the table's columns.
const DAY = cn(
  'h-(--shifa-size-control-md) w-(--shifa-size-control-md) cursor-pointer rounded-pill border-2 border-transparent p-0',
  'text-center align-middle text-250 leading-heading tabular-nums text-text-default outline-none',
  'hover:bg-selection-subtle',
  'data-outside:text-text-muted',
  'data-today:border-brand-primary data-today:font-semibold',
  'data-selected:bg-brand-primary data-selected:font-semibold data-selected:text-brand-on-primary',
  'data-disabled:cursor-not-allowed data-disabled:bg-transparent data-disabled:text-text-disabled',
  'data-unavailable:cursor-not-allowed data-unavailable:text-text-disabled',
  'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
);

export function DatePicker({
  label,
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  maxMessage,
  showAge = false,
  openLabel,
  hint,
  error,
  disabled,
  required,
  name,
  className,
}: DatePickerProps) {
  const dir = useDirection();
  const autoComplete = useFieldAutoComplete() ?? 'off';
  const [field, setField] = useState<HTMLDivElement | null>(null);
  const labels = LABELS[dir];
  const date = useDateEntry({
    dir,
    value,
    defaultValue,
    onValueChange,
    min,
    max,
    maxMessage,
    showAge,
  });
  return (
    <FieldShell
      label={label}
      // A complete date is confirmed in the hint line, read with the field.
      hint={date.line ?? hint}
      // An error from the form wins over the typed date's own.
      error={hasError(error) ? error : (date.error ?? undefined)}
      required={required}
      disabled={disabled}
      name={name}
      className={className}
    >
      <BaseDatePicker
        locale={DATE_LOCALE[dir]}
        weekStartsOn={SATURDAY}
        weekdayFormat="narrow"
        showOutsideDays
        value={date.value}
        onValueChange={(next: unknown) => {
          date.choose(typeof next === 'string' ? next : null);
        }}
        month={date.month}
        onMonthChange={(next: string) => {
          date.setMonth(next);
        }}
        onOpenChange={(open: boolean) => {
          if (open) date.openMonth();
        }}
        {...(min === undefined ? {} : { min })}
        {...(max === undefined ? {} : { max })}
        {...(required === undefined ? {} : { required })}
      >
        <div ref={setField} data-slot="date-picker-field" className={cn(FIELD_BOX, 'ps-3 pe-1')}>
          <DateSegments
            dir={dir}
            entry={date.entry}
            onEntryChange={date.setEntry}
            // Off unless a FormField names a token, such as bday (OD-67).
            autoComplete={autoComplete}
            disabled={disabled}
            required={required}
            onLeave={date.onLeave}
            onEnter={date.onEnter}
          />
          <DatePickerTrigger aria-label={openLabel ?? labels.open} className={NAV}>
            <Icon name="calendar" />
          </DatePickerTrigger>
        </div>
        <DatePickerContent
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          {...(field === null ? {} : { anchor: field })}
          aria-label={labels.calendar}
          className={cn(
            FLOATING_BOX,
            'flex w-(--shifa-size-popover) max-w-full flex-col gap-3 p-4',
          )}
        >
          <div className="flex items-center gap-2">
            <CalendarPrevious aria-label={labels.previous} className={NAV}>
              <Icon name="caret-back" />
            </CalendarPrevious>
            <CalendarHeading className="m-0 flex-1 text-center text-body font-medium leading-heading" />
            <CalendarNext aria-label={labels.next} className={NAV}>
              <Icon name="caret-forward" />
            </CalendarNext>
          </div>
          <CalendarGrid className="w-full border-separate border-spacing-0.5">
            <CalendarWeekdays>
              {(index) => (
                <CalendarWeekday
                  index={index}
                  className="h-8 text-center text-200 font-medium leading-heading text-text-muted"
                />
              )}
            </CalendarWeekdays>
            <CalendarWeeks>
              {(cell) => <CalendarDay value={cell.date} className={DAY} />}
            </CalendarWeeks>
          </CalendarGrid>
        </DatePickerContent>
      </BaseDatePicker>
    </FieldShell>
  );
}
