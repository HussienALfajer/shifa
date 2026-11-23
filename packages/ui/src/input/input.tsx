// Input (slice 0.4-05), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Inputs and forms · 0.4-05"): the field box of Select and Number Input
// (44 px, radius 8, a light border that darkens on hover, the green ring at once), a 2 px danger
// border when invalid, raised and muted when disabled, raised and readable when read-only; an
// optional icon at the logical start. Latin content (phone, email, medicine) takes dir="auto".
// Behaviour from UI SDK's Input; inside a Field it is wired to the label, hint and error.
import { Input as BaseInput, InputGroup } from '@ui-sdk/react/input';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { FIELD_BOX, useFieldShell, WithField } from '../field/field-shell.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

type NativeInput = Omit<
  ComponentProps<'input'>,
  | 'className'
  | 'style'
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'type'
  | 'dir'
  | 'children'
  | 'ref'
  | 'disabled'
  | 'required'
>;

export interface InputProps extends NativeInput {
  /** The label above; leave it out inside a Field or with an aria-label. */
  label?: ReactNode;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  type?: 'text' | 'email' | 'tel' | 'search' | 'url' | undefined;
  /** "auto" where the content may be Latin inside Arabic (phone, email, medicine name). */
  dir?: 'auto' | 'ltr' | 'rtl' | undefined;
  /** An icon at the logical start (search). */
  startIcon?: IconName | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  ref?: Ref<HTMLInputElement> | undefined;
  className?: string | undefined;
}

/** The text of a control inside a field box. */
export const CONTROL_TEXT = cn(
  'min-w-0 flex-1 self-stretch border-0 bg-transparent p-0 font-ui text-body leading-heading text-inherit outline-none',
  'in-data-[density=compact]:text-250 placeholder:text-text-muted disabled:cursor-not-allowed',
);

export function Input({
  label,
  hint,
  error,
  value,
  defaultValue,
  onValueChange,
  type = 'text',
  startIcon,
  disabled,
  required,
  name,
  className,
  ...native
}: InputProps) {
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
      <InputGroup data-focus-ring="" className={cn(FIELD_BOX, 'px-3')}>
        {startIcon !== undefined && (
          <span className="inline-flex shrink-0">
            <Icon name={startIcon} />
          </span>
        )}
        <BaseInput
          {...native}
          type={type}
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
          className={CONTROL_TEXT}
        />
      </InputGroup>
    </WithField>
  );
}
