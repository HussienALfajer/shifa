// OTP Input (slice 0.4-05), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Inputs and forms · 0.4-05") with OD-62: six large slots (48 × 52 px, the
// same in both densities: it is used on phones and at sign-in), laid out left to right in both
// directions because a code is a number and numbers never mirror; in Arabic the row sits at the
// line's start (the right). The active slot shows the focus ring and a caret.
//
// Behaviour from UI SDK's OTP Input: one real input behind the slots (one field for screen
// readers, autocomplete="one-time-code", paste, undo, autofill); the slots are drawn from it.
// This wrapper adds OD-20: Arabic-Indic digits are accepted and the value keeps Western ones.
import { OTPInput, OTPInputGroup, OTPInputSlot } from '@ui-sdk/react/otp-input';
import { type ReactNode, type Ref, useState } from 'react';
import { hasError, useFieldShell, WithField } from '../field/field-shell.tsx';
import { cn } from '../lib/cn.ts';
import { toWesternDigits } from '../lib/digits.ts';
import { useDirection } from '../providers/direction-provider.tsx';

/** One digit, Western or Arabic-Indic (OD-20). */
const DIGIT = /[0-9٠-٩۰-۹]/;

export interface OtpInputProps {
  /** Shown above; «رمز التحقق» names the field when there is no label and no Field. */
  label?: ReactNode;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  /** The number of digits (6 by default, OD-62). */
  length?: number | undefined;
  value?: string | undefined;
  defaultValue?: string | undefined;
  /** The code so far, in Western digits. */
  onValueChange?: ((value: string) => void) | undefined;
  /** Every slot is filled: the code, in Western digits. */
  onComplete?: ((code: string) => void) | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  name?: string | undefined;
  onBlur?: (() => void) | undefined;
  ref?: Ref<HTMLDivElement> | undefined;
  'aria-label'?: string | undefined;
  className?: string | undefined;
}

const SLOT = cn(
  'relative inline-flex h-13 w-12 items-center justify-center rounded-input border',
  'border-(--shifa-input-border) bg-(--shifa-input-bg) text-(--shifa-input-fg)',
  'font-ui text-500 font-semibold leading-heading tabular-nums',
  'data-active:border-border-focus data-active:shadow-focus data-active:outline-2 data-active:outline-border-focus',
  'in-data-[invalid]:border-2 in-data-[invalid]:border-status-danger-fg',
  'in-data-disabled:border-border-default in-data-disabled:bg-bg-surface-raised in-data-disabled:text-text-disabled',
);

export function OtpInput({
  label,
  hint,
  error,
  length = 6,
  value,
  defaultValue,
  onValueChange,
  onComplete,
  disabled,
  required,
  name,
  onBlur,
  ref,
  'aria-label': ariaLabel,
  className,
}: OtpInputProps) {
  const dir = useDirection();
  const field = useFieldShell();
  const isRequired = required ?? field?.required;
  const isDisabled = disabled ?? field?.disabled;
  const invalid = hasError(error) || field?.invalid === true;
  const [own, setOwn] = useState(toWesternDigits(defaultValue ?? ''));
  // Once controlled (a form field), an undefined value means empty, not the last typed code.
  const [controlled, setControlled] = useState(value !== undefined);
  if (value !== undefined && !controlled) setControlled(true);
  const current = value === undefined ? (controlled ? '' : own) : toWesternDigits(value);
  const named = label !== undefined || field !== null;
  return (
    <WithField
      label={label}
      hint={hint}
      error={error}
      required={isRequired}
      disabled={isDisabled}
      className={className}
    >
      <OTPInput
        {...(ref === undefined ? {} : { ref })}
        maxLength={length}
        pattern={DIGIT}
        inputMode="numeric"
        value={current}
        onValueChange={(raw: string) => {
          const next = toWesternDigits(raw);
          setOwn(next);
          onValueChange?.(next);
          if (next.length === length) onComplete?.(next);
        }}
        {...(name === undefined ? {} : { name })}
        {...(isRequired === true ? { required: true } : {})}
        {...(isDisabled === true ? { disabled: true } : {})}
        {...(onBlur === undefined ? {} : { onBlur })}
        {...(named ? {} : { 'aria-label': ariaLabel ?? 'رمز التحقق' })}
        {...(invalid && field === null && label === undefined ? { 'aria-invalid': true } : {})}
        {...(invalid ? { 'data-invalid': '' } : {})}
        // Digits never mirror: the field (and its caret) and the slots run left to right in both
        // directions, so the arrows move to the slot on that side. In Arabic the row sits at the
        // line's start, the right.
        dir="ltr"
        className={cn('flex', dir === 'rtl' ? 'justify-end' : 'justify-start')}
      >
        <OTPInputGroup className="flex gap-2">
          {Array.from({ length }, (_, index) => (
            // The slots are fixed positions of one code; their index is their identity.
            <OTPInputSlot key={`slot-${String(index)}`} index={index} className="relative">
              {(state: { char: string | null; active: boolean; hasFakeCaret: boolean }) => (
                <span
                  data-slot="otp-slot"
                  data-focus-ring=""
                  {...(state.active ? { 'data-active': '' } : {})}
                  className={SLOT}
                >
                  {state.char ?? ''}
                  {state.hasFakeCaret && (
                    <span
                      aria-hidden="true"
                      className="h-6 w-0.5 animate-pulse bg-text-default motion-reduce:animate-none"
                    />
                  )}
                </span>
              )}
            </OTPInputSlot>
          ))}
        </OTPInputGroup>
      </OTPInput>
    </WithField>
  );
}
