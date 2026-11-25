// Time Input (slice 0.4-05), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Inputs and forms · 0.4-05") with OD-62: Input's box holding an hour and a
// minute segment, and a ص/م segment on the 12-hour clock (a clinic setting; 24-hour by default),
// with a clock icon at the logical end. A time is written as a number, so the segments run left
// to right in both directions and Left and Right move to the segment on that side. The value is
// always "HH:mm" (24 hours), whatever the clock shows.
//
// Behaviour from UI SDK's Time Input: each segment is a spinbutton named by its unit; digits
// fill a segment and move on; Up and Down step and wrap. This wrapper adds the Arabic and
// English segment names and OD-20 (Arabic-Indic digits accepted, Western ones shown).
// Since slice 0.4-13 (OD-70 B) the clock is a button that opens the clinic's slots
// (`time-slot-grid.tsx`): Enter or Space on it, or Alt+Down from a segment; one press fills the
// segments. Typing stays the main way in.
import {
  TimeInput as BaseTimeInput,
  createTimeInputController,
  TimeInputSegment,
} from '@ui-sdk/react/time-input';
import { type ReactNode, type Ref, useState } from 'react';
import { FIELD_BOX, hasError, useFieldShell, WithField } from '../field/field-shell.tsx';
import { cn } from '../lib/cn.ts';
import { useArabicIndicKeys } from '../lib/use-arabic-indic-keys.ts';
import { useDirection } from '../providers/direction-provider.tsx';
import { TimeSlotGrid } from './time-slot-grid.tsx';

/**
 * Western digits in both languages (OD-20); the 12-hour period is ص / م in Arabic and AM / PM in
 * English (en-US: en-GB writes "pm" in lower case).
 */
export const TIME_LOCALE = { rtl: 'ar-SY-u-nu-latn', ltr: 'en-US' } as const;

const SEGMENT_NAMES = {
  rtl: { hour: 'الساعة', minute: 'الدقائق', second: 'الثواني', dayPeriod: 'ص/م' },
  ltr: { hour: 'Hour', minute: 'Minute', second: 'Second', dayPeriod: 'AM/PM' },
} as const;

/** The group's name when it has no label and no Field. */
const GROUP_NAME = { rtl: 'الوقت', ltr: 'Time' } as const;

export interface TimeInputProps {
  label?: ReactNode;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  /** "HH:mm" in 24 hours, or null. */
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  /** "HH:mm" once both segments are filled, null when one is emptied. */
  onValueChange?: ((value: string | null) => void) | undefined;
  /** 24 (default) or 12 with a ص/م segment: the clinic's setting (OD-62). */
  hourCycle?: 12 | 24 | undefined;
  /** The earliest and latest time ("09:00"). */
  min?: string | undefined;
  max?: string | undefined;
  /** Minutes between the slots the clock button offers: 15 by default; it must divide 60. */
  step?: number | undefined;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  required?: boolean | undefined;
  name?: string | undefined;
  onBlur?: (() => void) | undefined;
  /** The slot list open or closed, controlled; with `onOpenChange`. */
  open?: boolean | undefined;
  /** The slot list open at mount (closed by default): to show it at rest, as the canvas does. */
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  ref?: Ref<HTMLDivElement> | undefined;
  'aria-label'?: string | undefined;
  className?: string | undefined;
}

interface Segment {
  type: string;
}

export function TimeInput({
  label,
  hint,
  error,
  value,
  defaultValue,
  onValueChange,
  hourCycle = 24,
  min,
  max,
  step,
  disabled,
  readOnly,
  required,
  name,
  onBlur,
  open,
  defaultOpen,
  onOpenChange,
  ref,
  'aria-label': ariaLabel,
  className,
}: TimeInputProps) {
  const dir = useDirection();
  const field = useFieldShell();
  const isRequired = required ?? field?.required;
  const isDisabled = disabled ?? field?.disabled;
  const invalid = hasError(error) || field?.invalid === true;
  const arabicIndicKeys = useArabicIndicKeys();
  const names = SEGMENT_NAMES[dir];
  // The slot grid fills the segments through UI SDK's controller, as typing would.
  const [controller] = useState(createTimeInputController);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  // The slot list: held here even when controlled, as Menu holds its own.
  const [innerOpen, setInnerOpen] = useState(defaultOpen ?? false);
  // Never open on a field that cannot change: a slot press would set the time anyway.
  const slotsOpen = isDisabled !== true && readOnly !== true && (open ?? innerOpen);
  const setOpen = (next: boolean) => {
    if (next === slotsOpen) return;
    setInnerOpen(next);
    onOpenChange?.(next);
  };
  // The time shown, so the grid can mark it, whether the field is controlled or not.
  const [own, setOwn] = useState<string | null>(defaultValue ?? null);
  const current = value === undefined ? own : value;
  return (
    <WithField
      label={label}
      hint={hint}
      error={error}
      required={isRequired}
      disabled={isDisabled}
      className={className}
      mutedLabelWhenDisabled
    >
      <div
        ref={setBox}
        data-focus-ring=""
        // Alt+Down from a segment opens the slots, as a select opens its list.
        onKeyDown={(event) => {
          if (
            event.altKey &&
            event.key === 'ArrowDown' &&
            isDisabled !== true &&
            readOnly !== true
          ) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(FIELD_BOX, 'w-auto ps-3 pe-1')}
      >
        <BaseTimeInput
          ref={(el: HTMLDivElement | null) => {
            const cleanup = arabicIndicKeys(el);
            if (typeof ref === 'function') ref(el);
            else if (ref !== undefined && ref !== null) ref.current = el;
            return () => {
              cleanup?.();
              if (typeof ref === 'function') ref(null);
              else if (ref !== undefined && ref !== null) ref.current = null;
            };
          }}
          dir="ltr"
          locale={TIME_LOCALE[dir]}
          hourCycle={hourCycle}
          controller={controller}
          {...(value === undefined ? {} : { value })}
          {...(defaultValue === undefined ? {} : { defaultValue })}
          {...(min === undefined ? {} : { min })}
          {...(max === undefined ? {} : { max })}
          {...(name === undefined ? {} : { name })}
          {...(isRequired === true ? { required: true } : {})}
          {...(isDisabled === true ? { disabled: true } : {})}
          {...(readOnly === true ? { readOnly: true } : {})}
          {...(onBlur === undefined ? {} : { onBlur })}
          {...(invalid ? { 'aria-invalid': true } : {})}
          {...(label === undefined && field === null
            ? { 'aria-label': ariaLabel ?? GROUP_NAME[dir] }
            : {})}
          onValueChange={(next: string | null) => {
            setOwn(next);
            onValueChange?.(next);
          }}
          // Left to right inside; in Arabic the time sits at the line's start, the right.
          className={cn(
            'flex flex-1 items-center tabular-nums',
            dir === 'rtl' ? 'justify-end' : 'justify-start',
          )}
        >
          {(state: { segments: Segment[] }) =>
            state.segments.map((segment, index) => {
              const unit = segment.type as keyof typeof names | 'literal';
              return (
                <TimeInputSegment
                  // Segments are fixed places of one time; type and place are their identity.
                  key={`${segment.type}-${String(index)}`}
                  segment={segment as never}
                  {...(unit === 'literal' ? {} : { 'aria-label': names[unit] })}
                  className={cn(
                    // A segment is an input: as wide as its text, no box of its own.
                    'field-sizing-content min-w-6 border-0 bg-transparent p-0 text-center font-ui text-body leading-heading in-data-[density=compact]:text-250 text-inherit tabular-nums outline-none',
                    'rounded-mark px-0.5 data-[type=literal]:min-w-0 data-[type=literal]:px-0 data-[type=dayPeriod]:ms-1',
                    'focus:bg-selection-strong data-empty:text-text-muted',
                    'data-disabled:text-text-disabled',
                  )}
                />
              );
            })
          }
        </BaseTimeInput>
        <TimeSlotGrid
          dir={dir}
          anchor={box}
          open={slotsOpen}
          onOpenChange={setOpen}
          value={current}
          min={min}
          max={max}
          step={step}
          hourCycle={hourCycle}
          disabled={isDisabled === true || readOnly === true}
          onChoose={(next) => {
            controller.setValue(next);
          }}
        />
      </div>
    </WithField>
  );
}
