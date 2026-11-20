// Radio (slice 0.4-05), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Inputs and forms · 0.4-05"): a named group of choices, one per line
// (vertical, the default) or in a row for short choices (horizontal); a 20 px ring at the
// logical start, a green ring and dot when checked. Behaviour from UI SDK's Radio group: one tab
// stop (the checked option, else the first), arrows move and check, follow the reading
// direction (Left is next in Arabic), skip disabled options and wrap.
import { Field, FieldDescription } from '@ui-sdk/react/field';
import {
  Radio as BaseRadio,
  RadioGroup as BaseRadioGroup,
  RadioIndicator,
} from '@ui-sdk/react/radio';
import type { ReactNode, Ref } from 'react';
import { CHOICE_LINE, CHOICE_MARK } from '../checkbox/checkbox.tsx';
import { FIELD_TEXT, hasError, useFieldShell, WithField } from '../field/field-shell.tsx';
import { cn } from '../lib/cn.ts';

export interface RadioGroupProps {
  /** Names the group; shown above it. */
  label?: ReactNode;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  /** vertical (default) or horizontal for two or three short choices. */
  orientation?: 'vertical' | 'horizontal' | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  name?: string | undefined;
  onBlur?: (() => void) | undefined;
  /** Focuses the checked option, else the first (a form's first invalid field). */
  ref?: Ref<{ focus: () => void }> | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function RadioGroup({
  label,
  hint,
  error,
  value,
  defaultValue,
  onValueChange,
  orientation = 'vertical',
  disabled,
  required,
  name,
  onBlur,
  ref,
  className,
  children,
}: RadioGroupProps) {
  const field = useFieldShell();
  const isRequired = required ?? field?.required;
  const isDisabled = disabled ?? field?.disabled;
  const invalid = hasError(error) || field?.invalid === true;
  return (
    <WithField
      label={label}
      hint={hint}
      error={error}
      required={isRequired}
      disabled={isDisabled}
      className={className}
    >
      <BaseRadioGroup
        ref={(el: HTMLElement | null) => {
          const handle =
            el === null
              ? null
              : {
                  focus: () => {
                    const target =
                      el.querySelector<HTMLElement>('[role=radio][aria-checked=true]') ??
                      el.querySelector<HTMLElement>('[role=radio]:not([data-disabled])');
                    target?.focus();
                  },
                };
          if (typeof ref === 'function') ref(handle);
          else if (ref !== undefined && ref !== null) ref.current = handle;
        }}
        aria-orientation={orientation}
        {...(invalid ? { 'aria-invalid': true } : {})}
        {...(value === undefined ? {} : { value })}
        {...(defaultValue === undefined ? {} : { defaultValue })}
        {...(isDisabled === true ? { disabled: true } : {})}
        {...(isRequired === true ? { required: true } : {})}
        {...(name === undefined ? {} : { name })}
        {...(onBlur === undefined ? {} : { onBlur })}
        onValueChange={(next: string | null) => {
          if (next !== null) onValueChange?.(next);
        }}
        className={cn(
          'flex',
          orientation === 'horizontal' ? 'flex-row flex-wrap gap-x-6' : 'flex-col',
        )}
      >
        {children}
      </BaseRadioGroup>
    </WithField>
  );
}

export interface RadioProps {
  value: string;
  /** The text after the ring; it names the option. */
  children: ReactNode;
  /** A line under the text, read with the option. */
  description?: ReactNode | undefined;
  disabled?: boolean | undefined;
}

export function Radio({ value, children, description, disabled }: RadioProps) {
  const line = (
    <label className={CHOICE_LINE}>
      <BaseRadio
        value={value}
        {...(disabled === true ? { disabled: true } : {})}
        className={cn(
          CHOICE_MARK,
          'rounded-pill data-checked:border-brand-primary',
          'in-aria-invalid:border-status-danger-fg',
        )}
      >
        <RadioIndicator className="size-2 rounded-pill bg-brand-primary in-data-disabled:bg-text-disabled" />
      </BaseRadio>
      <span className="py-2 in-data-[density=compact]:py-1">{children}</span>
    </label>
  );
  if (description === undefined) return line;
  return (
    <Field {...(disabled === true ? { disabled: true } : {})} className="flex flex-col">
      {line}
      <FieldDescription className={cn(FIELD_TEXT.hint, '-mt-2 ps-7')}>
        {description}
      </FieldDescription>
    </Field>
  );
}
