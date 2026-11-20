// Number Input (slice 0.4-04), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Gate components · 0.4-04"): a field with «إنقاص» at its logical start and
// «زيادة» at its end, each a 44 px target (32 compact); Western digits in tabular figures with
// comma grouping (OD-20, OD-61); an optional unit at the end. Behaviour from UI SDK's Number
// Input: Up and Down step by one, Page Up and Page Down by ten, a stepper at its limit is
// disabled, typed text is checked and formatted on commit.
//
// Two things UI SDK does not do and this wrapper adds (RTL gate, fixed by a wrapper):
// - Arabic-Indic digits: UI SDK accepts them only in a locale that also shows them, so a typed
//   ٠–٩ (or ۰–۹, or the Arabic decimal ٫) is turned into its Western form before UI SDK sees it.
// - The control is a plain text input; it gets role=spinbutton and its value, minimum and
//   maximum, as the spinbutton pattern asks.
import {
  NumberInput as BaseNumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
} from '@ui-sdk/react/number-input';
import { type ReactNode, useState } from 'react';
import { FIELD_BOX, FieldShell } from '../field/field-shell.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { useWesternDigits } from '../lib/use-western-digits.ts';
import { useDirection } from '../providers/direction-provider.tsx';

/** Western digits and comma grouping in both languages (OD-20, OD-61). */
export const NUMBER_LOCALE = { rtl: 'ar-SY-u-nu-latn', ltr: 'en-GB' } as const;

export interface NumberInputProps {
  label: ReactNode;
  value?: number | null | undefined;
  defaultValue?: number | null | undefined;
  onValueChange?: ((value: number | null) => void) | undefined;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  /** A unit after the number («ل.س»). Screen readers reach it after the field; name it in the label too when it matters. */
  unit?: string | undefined;
  /** The − and + buttons; off for amounts, which are typed. */
  steppers?: boolean | undefined;
  decrementLabel?: string | undefined;
  incrementLabel?: string | undefined;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  name?: string | undefined;
  className?: string | undefined;
}

const STEPPER = cn(
  'inline-flex w-(--shifa-input-height) shrink-0 cursor-pointer items-center justify-center self-stretch',
  'border-0 bg-transparent text-text-default outline-none hover:bg-selection-subtle active:bg-selection-default',
  'data-disabled:cursor-not-allowed data-disabled:bg-transparent data-disabled:text-text-disabled',
  'disabled:cursor-not-allowed disabled:bg-transparent disabled:text-text-disabled',
);

export function NumberInput({
  label,
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  step,
  unit,
  steppers = true,
  decrementLabel = 'إنقاص',
  incrementLabel = 'زيادة',
  hint,
  error,
  disabled,
  required,
  name,
  className,
}: NumberInputProps) {
  const dir = useDirection();
  const westernDigits = useWesternDigits();
  // The current number, for aria-valuenow (UI SDK's control is a plain text input).
  const [current, setCurrent] = useState<number | null>(value ?? defaultValue ?? null);
  const shown = value === undefined ? current : value;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      disabled={disabled}
      name={name}
      className={className}
    >
      <BaseNumberInput
        locale={NUMBER_LOCALE[dir]}
        {...(value === undefined ? {} : { value })}
        {...(defaultValue === undefined ? {} : { defaultValue })}
        {...(min === undefined ? {} : { min })}
        {...(max === undefined ? {} : { max })}
        {...(step === undefined ? {} : { step })}
        {...(required === undefined ? {} : { required })}
        onValueChange={(next: number | null) => {
          setCurrent(next);
          onValueChange?.(next);
        }}
      >
        <NumberInputGroup
          className={cn(FIELD_BOX, 'gap-0 overflow-hidden px-0', !steppers && 'px-3')}
        >
          {steppers && (
            <NumberInputDecrement
              aria-label={decrementLabel}
              className={cn(STEPPER, 'border-e border-border-default')}
            >
              <Icon name="minus" />
            </NumberInputDecrement>
          )}
          <NumberInputControl
            ref={westernDigits}
            role="spinbutton"
            {...(shown === null ? {} : { 'aria-valuenow': shown })}
            {...(min === undefined ? {} : { 'aria-valuemin': min })}
            {...(max === undefined ? {} : { 'aria-valuemax': max })}
            className={cn(
              'min-w-0 flex-1 self-stretch border-0 bg-transparent p-0 font-ui text-body leading-heading in-data-[density=compact]:text-250 text-inherit tabular-nums outline-none',
              steppers ? 'px-2 text-center' : 'text-start',
            )}
          />
          {unit !== undefined && <span className="shrink-0 text-200 text-text-muted">{unit}</span>}
          {steppers && (
            <NumberInputIncrement
              aria-label={incrementLabel}
              className={cn(STEPPER, 'border-s border-border-default')}
            >
              <Icon name="plus" />
            </NumberInputIncrement>
          )}
        </NumberInputGroup>
      </BaseNumberInput>
    </FieldShell>
  );
}
