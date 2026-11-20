// Checkbox (slice 0.4-05), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Inputs and forms · 0.4-05"): a 20 px mark (radius 4) at the logical start,
// the text after it, the whole line a 44 px target (32 compact); checked is a green mark with a
// white tick, "some" a dash; the state is told by the shape, not colour alone. An optional
// description under the text, and an error with its icon under the line. Behaviour from UI
// SDK's Checkbox (Space toggles, a press on the text toggles).
import { Checkbox as BaseCheckbox, CheckboxIndicator } from '@ui-sdk/react/checkbox';
import { Field, FieldDescription } from '@ui-sdk/react/field';
import type { ReactNode, Ref } from 'react';
import { FIELD_TEXT, FieldErrorText, hasError, useFieldShell } from '../field/field-shell.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

export interface CheckboxProps {
  /** The text after the mark; it names the checkbox. */
  children: ReactNode;
  /** `"indeterminate"` for a "select all" that covers some rows. */
  checked?: boolean | 'indeterminate' | undefined;
  defaultChecked?: boolean | 'indeterminate' | undefined;
  onCheckedChange?: ((checked: boolean) => void) | undefined;
  /** A line under the text, read with it. */
  description?: ReactNode | undefined;
  error?: ReactNode | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  name?: string | undefined;
  /** What a checked box submits (default "on"). */
  value?: string | undefined;
  onBlur?: (() => void) | undefined;
  ref?: Ref<HTMLButtonElement> | undefined;
  className?: string | undefined;
}

/** The line: mark and text, a 44 px target. Shared with Radio. */
export const CHOICE_LINE = cn(
  'flex min-h-(--shifa-size-target-min) cursor-pointer items-center gap-2 font-ui text-body leading-heading text-text-default',
  'in-data-[density=compact]:min-h-(--shifa-size-control-md) in-data-[density=compact]:text-250',
  'has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:text-text-disabled',
);

/** The 20 px mark of a checkbox or radio, by its data attributes. */
export const CHOICE_MARK = cn(
  'relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center border-2 p-0',
  'border-border-strong bg-bg-surface text-brand-on-primary',
  'transition-colors duration-(--shifa-motion-duration-fast) motion-reduce:transition-none',
  'hover:border-text-muted',
  'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus focus-visible:transition-none',
  'aria-invalid:border-status-danger-fg',
  'data-disabled:cursor-not-allowed data-disabled:border-border-default data-disabled:bg-bg-surface-raised data-disabled:text-text-disabled',
);

export function Checkbox({
  children,
  checked,
  defaultChecked,
  onCheckedChange,
  description,
  error,
  disabled,
  required,
  name,
  value,
  onBlur,
  ref,
  className,
}: CheckboxProps) {
  const field = useFieldShell();
  const invalid = hasError(error) || field?.invalid === true;
  const isDisabled = disabled ?? field?.disabled;
  const box = (
    <label className={CHOICE_LINE}>
      <BaseCheckbox
        {...(ref === undefined ? {} : { ref })}
        {...(checked === undefined ? {} : { checked })}
        {...(defaultChecked === undefined ? {} : { defaultChecked })}
        {...(isDisabled === true ? { disabled: true } : {})}
        {...(required === true ? { required: true } : {})}
        {...(name === undefined ? {} : { name })}
        {...(value === undefined ? {} : { value })}
        {...(onBlur === undefined ? {} : { onBlur })}
        {...(invalid && field === null ? { 'aria-invalid': true } : {})}
        onCheckedChange={(next) => onCheckedChange?.(next === true)}
        className={cn(
          CHOICE_MARK,
          'rounded-mark data-checked:border-brand-primary data-checked:bg-brand-primary',
          'data-indeterminate:border-brand-primary data-indeterminate:bg-brand-primary',
          'data-disabled:data-checked:border-border-default data-disabled:data-checked:bg-bg-surface-raised',
        )}
      >
        <CheckboxIndicator className="inline-flex">
          {(state: { indeterminate?: boolean }) => (
            <Icon name={state.indeterminate === true ? 'minus' : 'check'} className="size-4" />
          )}
        </CheckboxIndicator>
      </BaseCheckbox>
      <span className="flex min-w-0 flex-col gap-0.5 py-2 in-data-[density=compact]:py-1">
        <span>{children}</span>
      </span>
    </label>
  );
  // Inside an outer Field (a form field) the Field reads the description and error.
  if (field !== null) return box;
  return (
    <Field
      {...(invalid ? { invalid: true } : {})}
      {...(isDisabled === true ? { disabled: true } : {})}
      className={cn('flex flex-col', className)}
    >
      {box}
      {description !== undefined && (
        <FieldDescription className={cn(FIELD_TEXT.hint, '-mt-2 ps-7')}>
          {description}
        </FieldDescription>
      )}
      {hasError(error) && <FieldErrorText>{error}</FieldErrorText>}
    </Field>
  );
}
