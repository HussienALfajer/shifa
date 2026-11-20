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
import { TimeInput as BaseTimeInput, TimeInputSegment } from '@ui-sdk/react/time-input';
import type { ReactNode, Ref } from 'react';
import { FIELD_BOX, hasError, useFieldShell, WithField } from '../field/field-shell.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { useArabicIndicKeys } from '../lib/use-arabic-indic-keys.ts';
import { useDirection } from '../providers/direction-provider.tsx';

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
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  required?: boolean | undefined;
  name?: string | undefined;
  onBlur?: (() => void) | undefined;
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
  disabled,
  readOnly,
  required,
  name,
  onBlur,
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
      <div data-focus-ring="" className={cn(FIELD_BOX, 'w-auto px-3')}>
        <BaseTimeInput
          ref={(el: HTMLDivElement | null) => {
            const cleanup = arabicIndicKeys(el);
            if (typeof ref === 'function') ref(el);
            else if (ref !== undefined && ref !== null) ref.current = el;
            return cleanup;
          }}
          dir="ltr"
          locale={TIME_LOCALE[dir]}
          hourCycle={hourCycle}
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
          {...(onValueChange === undefined
            ? {}
            : {
                onValueChange: (next: string | null) => {
                  onValueChange(next);
                },
              })}
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
        <span className="inline-flex shrink-0 text-icon-muted">
          <Icon name="clock" />
        </span>
      </div>
    </WithField>
  );
}
