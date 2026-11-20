// The label, hint and error around a form control (slice 0.4-04), as on the approved sheet: the
// label above in label-sm, a muted hint, and an error in the danger colour with a warning icon,
// so an error is never told by colour alone. UI SDK's Field wires them to the control
// (aria-labelledby, aria-describedby, aria-invalid). Internal: 0.4-05 exports the public Field.
import { Field, FieldDescription, FieldError, FieldLabel } from '@ui-sdk/react/field';
import type { ReactNode } from 'react';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

export interface FieldShellProps {
  /** The visible label; it names the control. */
  label: ReactNode;
  /** A short hint under the control, read with it. */
  hint?: ReactNode | undefined;
  /** An error from the form or the server: marks the control invalid and is read with it. */
  error?: ReactNode | undefined;
  disabled?: boolean | undefined;
  /** The name the control submits under. */
  name?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** The text styles of the three parts, shared with controls that render their own label. */
export const FIELD_TEXT = {
  label: cn(
    'text-200 leading-heading font-medium text-text-default data-disabled:text-text-disabled',
  ),
  hint: cn('text-200 leading-body text-text-muted'),
  error: cn('flex items-center gap-1 text-200 leading-body text-status-danger-fg'),
} as const;

/** The border, colours and focus ring of a text-like control, by its data attributes. */
export const FIELD_BOX = cn(
  'flex min-h-(--shifa-input-height) w-full items-center gap-2 rounded-input border',
  'border-(--shifa-input-border) bg-(--shifa-input-bg) text-(--shifa-input-fg)',
  'font-ui text-body leading-heading tabular-nums in-data-[density=compact]:text-250',
  'transition-colors duration-(--shifa-motion-duration-fast) motion-reduce:transition-none',
  'hover:border-border-strong',
  // The focus ring appears at once (no transition), around the whole box.
  'has-[:focus-visible]:border-border-focus has-[:focus-visible]:shadow-focus',
  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-border-focus has-[:focus-visible]:transition-none',
  'has-[[aria-invalid=true]]:border-2 has-[[aria-invalid=true]]:border-status-danger-fg',
  'has-[:disabled]:cursor-not-allowed has-[:disabled]:border-border-default',
  'has-[:disabled]:bg-bg-surface-raised has-[:disabled]:text-text-disabled',
);

export function FieldShell({
  label,
  hint,
  error,
  disabled,
  name,
  className,
  children,
}: FieldShellProps) {
  const invalid = error !== undefined && error !== null && error !== false;
  return (
    <Field
      {...(name === undefined ? {} : { name })}
      {...(disabled === undefined ? {} : { disabled })}
      {...(invalid ? { invalid: true } : {})}
      className={cn('flex flex-col gap-1', className)}
    >
      <FieldLabel className={FIELD_TEXT.label}>{label}</FieldLabel>
      {children}
      {hint !== undefined && (
        <FieldDescription className={FIELD_TEXT.hint}>{hint}</FieldDescription>
      )}
      {invalid && (
        <FieldError match className={FIELD_TEXT.error}>
          <Icon name="warning" />
          <span>{error}</span>
        </FieldError>
      )}
    </Field>
  );
}
