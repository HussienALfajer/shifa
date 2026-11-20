// The label, hint and error around a form control (slices 0.4-04 and 0.4-05), as on the approved
// sheets: the label above in label-sm, with a danger-coloured asterisk when the field is
// required (hidden from screen readers, which hear "required" from the control); a muted hint;
// and an error in the danger colour with a warning icon, so an error is never told by colour
// alone. UI SDK's Field wires them to the control (aria-labelledby, aria-describedby,
// aria-invalid). The public `Field` is this shell; controls with a `label` prop render it
// themselves.
import { Field, FieldDescription, FieldError, FieldLabel } from '@ui-sdk/react/field';
import { createContext, type ReactNode, useContext } from 'react';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

export interface FieldShellProps {
  /** The visible label; it names the control. Leave it out only when the control names itself. */
  label?: ReactNode;
  /** A short hint under the control, read with it. */
  hint?: ReactNode | undefined;
  /** An error from the form or the server: marks the control invalid and is read with it. */
  error?: ReactNode | undefined;
  /** Shows the asterisk and makes the control required. */
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  /** The name the control submits under. */
  name?: string | undefined;
  className?: string | undefined;
  /**
   * A disabled group (Time Input) keeps its label muted rather than disabled-grey: axe exempts
   * the label of a disabled input, not of a group, and the muted colour meets contrast.
   */
  mutedLabelWhenDisabled?: boolean | undefined;
  children: ReactNode;
}

/** What a Field tells the control inside it that UI SDK's Field does not pass on. */
export interface FieldShellState {
  required: boolean;
  disabled: boolean;
  invalid: boolean;
}

const FieldShellContext = createContext<FieldShellState | null>(null);

/** The surrounding Field's state, or null outside one. */
export const useFieldShell = (): FieldShellState | null => useContext(FieldShellContext);

/** The text styles of the parts, shared with controls that render their own label. */
export const FIELD_TEXT = {
  label: cn(
    'text-200 leading-heading font-medium text-text-default data-disabled:text-text-disabled',
  ),
  hint: cn('text-200 leading-body text-text-muted'),
  error: cn('flex items-center gap-1 text-200 leading-body text-status-danger-fg'),
  required: cn('ms-0.5 text-status-danger-fg'),
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
  // The control itself, not any disabled child: a stepper at its limit is disabled too.
  'has-[input:disabled,textarea:disabled]:cursor-not-allowed has-[input:disabled,textarea:disabled]:border-border-default',
  'has-[input:disabled,textarea:disabled]:bg-bg-surface-raised has-[input:disabled,textarea:disabled]:text-text-disabled',
  // Read-only keeps its text readable on the raised surface, with no hover.
  'has-[input[readonly]:not(:disabled),textarea[readonly]:not(:disabled)]:border-border-default',
  'has-[input[readonly]:not(:disabled),textarea[readonly]:not(:disabled)]:bg-bg-surface-raised',
);

/** The same box when it is the control itself (Select's trigger button). */
export const FIELD_BOX_SELF = cn(
  FIELD_BOX,
  'focus-visible:border-border-focus focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:transition-none',
  'aria-invalid:border-2 aria-invalid:border-status-danger-fg',
  'data-disabled:cursor-not-allowed data-disabled:border-border-default data-disabled:bg-bg-surface-raised data-disabled:text-text-disabled',
);

/** True when `error` holds something to show. */
export const hasError = (error: ReactNode): boolean =>
  error !== undefined && error !== null && error !== false && error !== '';

/** The error line: a warning icon and the text, in the danger colour. */
export function FieldErrorText({ children }: { children: ReactNode }) {
  return (
    <FieldError match data-slot="field-error" className={FIELD_TEXT.error}>
      <Icon name="warning" />
      <span>{children}</span>
    </FieldError>
  );
}

export function FieldShell({
  label,
  hint,
  error,
  required,
  disabled,
  name,
  className,
  mutedLabelWhenDisabled,
  children,
}: FieldShellProps) {
  const invalid = hasError(error);
  return (
    <FieldShellContext.Provider
      value={{ required: required === true, disabled: disabled === true, invalid }}
    >
      <Field
        {...(name === undefined ? {} : { name })}
        {...(disabled === undefined ? {} : { disabled })}
        {...(invalid ? { invalid: true } : {})}
        className={cn('flex flex-col gap-1', className)}
      >
        {label !== undefined && (
          <FieldLabel
            className={cn(
              FIELD_TEXT.label,
              mutedLabelWhenDisabled === true && 'data-disabled:text-text-muted',
            )}
          >
            {label}
            {required === true && (
              <span aria-hidden="true" className={FIELD_TEXT.required}>
                *
              </span>
            )}
          </FieldLabel>
        )}
        {children}
        {hint !== undefined && (
          <FieldDescription className={FIELD_TEXT.hint}>{hint}</FieldDescription>
        )}
        {invalid && <FieldErrorText>{error}</FieldErrorText>}
      </Field>
    </FieldShellContext.Provider>
  );
}

/** The props a control shares with Field: given a label, hint or error it renders its own. */
export interface WithFieldProps {
  label?: ReactNode;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  name?: string | undefined;
  className?: string | undefined;
  mutedLabelWhenDisabled?: boolean | undefined;
}

/**
 * Wraps `children` in a Field when the control was given a label, hint or error; otherwise the
 * control stands alone (inside an outer Field, or named by its own aria-label).
 */
export function WithField({ children, ...field }: WithFieldProps & { children: ReactNode }) {
  const own =
    field.label !== undefined || field.hint !== undefined || hasError(field.error ?? undefined);
  if (!own) return <>{children}</>;
  return <FieldShell {...field}>{children}</FieldShell>;
}
