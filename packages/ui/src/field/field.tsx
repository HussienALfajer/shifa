// Field (slice 0.4-05), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Inputs and forms · 0.4-05"): the label above the control, the required
// asterisk, a hint, and an error with its warning icon, all wired to the control inside for
// screen readers. Every control of the batch works inside it and, with its own `label`, outside.
import type { ReactNode } from 'react';
import { FieldShell } from './field-shell.tsx';

export interface FieldProps {
  /** The visible label; it names the control. */
  label: ReactNode;
  /** A short hint under the control, read with it. */
  hint?: ReactNode | undefined;
  /** The error to show; a message, never an i18n key (Form translates its keys). */
  error?: ReactNode | undefined;
  /** Shows the asterisk and makes the control required. */
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  /** The name the control submits under, when the control has none. */
  name?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function Field(props: FieldProps) {
  return <FieldShell {...props} />;
}
