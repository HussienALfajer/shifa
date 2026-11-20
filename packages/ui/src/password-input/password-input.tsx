// Password Input (slice 0.4-05), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Inputs and forms · 0.4-05"): Input's box with a 36 px show toggle inside it
// at the logical end. The toggle keeps one name («إظهار كلمة المرور») and reports its state with
// aria-pressed; its eye icon swaps. Typing is always left to right. Behaviour from UI SDK's
// Password Input: Tab goes from the field to the toggle; submit, reset and leaving the page hide
// the password again; a shown password is never spellchecked. This component never logs or
// stores the value.
import {
  PasswordInput as BasePasswordInput,
  PasswordInputControl,
  PasswordInputToggle,
} from '@ui-sdk/react/password-input';
import type { ReactNode, Ref } from 'react';
import { FIELD_BOX, useFieldShell, WithField } from '../field/field-shell.tsx';
import { Icon } from '../icons/icon.tsx';
import { CONTROL_TEXT } from '../input/input.tsx';
import { cn } from '../lib/cn.ts';
import { useDirection } from '../providers/direction-provider.tsx';

export interface PasswordInputProps {
  label?: ReactNode;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  /** current-password (default) for sign-in; new-password where one is chosen. */
  autoComplete?: 'current-password' | 'new-password' | undefined;
  /** The toggle's name. */
  showLabel?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  name?: string | undefined;
  onBlur?: (() => void) | undefined;
  ref?: Ref<HTMLInputElement> | undefined;
  'aria-label'?: string | undefined;
  className?: string | undefined;
}

export function PasswordInput({
  label,
  hint,
  error,
  value,
  defaultValue,
  onValueChange,
  autoComplete = 'current-password',
  showLabel = 'إظهار كلمة المرور',
  placeholder,
  disabled,
  required,
  name,
  onBlur,
  ref,
  'aria-label': ariaLabel,
  className,
}: PasswordInputProps) {
  const dir = useDirection();
  const field = useFieldShell();
  const isRequired = required ?? field?.required;
  const isDisabled = disabled ?? field?.disabled;
  return (
    <WithField
      label={label}
      hint={hint}
      error={error}
      required={isRequired}
      disabled={isDisabled}
      className={className}
    >
      <BasePasswordInput
        data-focus-ring=""
        autoComplete={autoComplete}
        {...(name === undefined ? {} : { name })}
        {...(value === undefined ? {} : { value })}
        {...(defaultValue === undefined ? {} : { defaultValue })}
        {...(isRequired === true ? { required: true } : {})}
        {...(isDisabled === true ? { disabled: true } : {})}
        {...(onValueChange === undefined
          ? {}
          : {
              onValueChange: (next: string) => {
                onValueChange(next);
              },
            })}
        className={cn(FIELD_BOX, 'gap-1 ps-3 pe-1')}
      >
        <PasswordInputControl
          dir="ltr"
          {...(ref === undefined ? {} : { ref })}
          {...(placeholder === undefined ? {} : { placeholder })}
          {...(onBlur === undefined ? {} : { onBlur })}
          {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
          // Typed left to right; aligned with the page's start (inside dir=ltr, the end is right).
          className={cn(CONTROL_TEXT, dir === 'rtl' ? 'text-end' : 'text-start')}
        />
        <PasswordInputToggle
          aria-label={showLabel}
          className={cn(
            'inline-flex size-(--shifa-size-control-sm) shrink-0 cursor-pointer items-center justify-center rounded-input border-0 bg-transparent p-0 text-icon-muted',
            'hover:bg-selection-subtle hover:text-text-default',
            'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
            'disabled:cursor-not-allowed disabled:bg-transparent disabled:text-text-disabled data-disabled:cursor-not-allowed',
          )}
        >
          {(state: { visible?: boolean }) => (
            <Icon name={state.visible === true ? 'eye-slash' : 'eye'} />
          )}
        </PasswordInputToggle>
      </BasePasswordInput>
    </WithField>
  );
}
