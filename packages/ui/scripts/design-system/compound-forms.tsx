// The composed form components (RadioGroup, Field, Form) as the design system sees them (slice
// 0.4-05). A canvas hands the bundle plain values only, so each takes its content as data and
// builds the parts of packages/ui inside. Form here draws a form in a given state (errors shown
// as written); in code it checks a Zod schema (packages/ui/src/form/form.tsx).
import { useState } from 'react';
import { Button } from '../../src/button/button.tsx';
import { Checkbox } from '../../src/checkbox/checkbox.tsx';
import { Field as CodeField } from '../../src/field/field.tsx';
import { FIELD_TEXT } from '../../src/field/field-shell.tsx';
import { Icon } from '../../src/icons/icon.tsx';
import { Input } from '../../src/input/input.tsx';
import { cn } from '../../src/lib/cn.ts';
import { OtpInput } from '../../src/otp-input/otp-input.tsx';
import { PasswordInput } from '../../src/password-input/password-input.tsx';
import { RadioGroup as CodeRadioGroup, Radio } from '../../src/radio/radio.tsx';
import { Switch } from '../../src/switch/switch.tsx';
import { Textarea } from '../../src/textarea/textarea.tsx';
import { TimeInput } from '../../src/time-input/time-input.tsx';

export interface RadioGroupData {
  label: string;
  items: { value: string; label: string; description?: string; disabled?: boolean }[];
  defaultValue?: string | null | undefined;
  orientation?: 'vertical' | 'horizontal' | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
}

export function RadioGroup({ items, ...group }: RadioGroupData) {
  return (
    <CodeRadioGroup {...group}>
      {items.map((item) => (
        <Radio
          key={item.value}
          value={item.value}
          description={item.description}
          disabled={item.disabled}
        >
          {item.label}
        </Radio>
      ))}
    </CodeRadioGroup>
  );
}

export interface FieldData {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** The text input inside, as Input takes it. */
  defaultValue?: string;
  placeholder?: string;
  dir?: 'auto' | 'ltr' | 'rtl';
}

/** A Field around an Input: the label, asterisk, hint and error of every control. */
export function Field({ label, hint, error, required, disabled, ...input }: FieldData) {
  return (
    <CodeField label={label} hint={hint} error={error} required={required} disabled={disabled}>
      <Input {...input} />
    </CodeField>
  );
}

interface TextEntry {
  kind: 'input' | 'password' | 'textarea' | 'time' | 'otp';
  label: string;
  defaultValue?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  dir?: 'auto' | 'ltr' | 'rtl';
  hourCycle?: 12 | 24;
  /** A row of two: this entry and the next share a line. */
  half?: boolean;
}

type FormEntry =
  | TextEntry
  | {
      kind: 'radio';
      label: string;
      items: { value: string; label: string }[];
      defaultValue?: string;
      error?: string;
      required?: boolean;
      orientation?: 'vertical' | 'horizontal';
      half?: boolean;
    }
  | {
      kind: 'checkbox' | 'switch';
      label: string;
      defaultChecked?: boolean;
      error?: string;
      half?: boolean;
    };

export interface FormData {
  title?: string;
  /** The line above the fields after a failed submit («حقلان يحتاجان إلى تصحيح»). */
  summary?: string;
  fields: FormEntry[];
  submitLabel: string;
  cancelLabel?: string;
  /** The submit button busy, as during an async submit. */
  submitting?: boolean;
}

function control(entry: FormEntry) {
  if (entry.kind === 'radio') {
    return (
      <RadioGroup
        label={entry.label}
        items={entry.items}
        defaultValue={entry.defaultValue}
        error={entry.error}
        required={entry.required}
        orientation={entry.orientation}
      />
    );
  }
  if (entry.kind === 'checkbox' || entry.kind === 'switch') {
    return entry.kind === 'checkbox' ? (
      <Checkbox defaultChecked={entry.defaultChecked} error={entry.error}>
        {entry.label}
      </Checkbox>
    ) : (
      <Switch defaultChecked={entry.defaultChecked}>{entry.label}</Switch>
    );
  }
  const { kind, hourCycle, dir, label, defaultValue, hint, error, required } = entry as TextEntry;
  const text = { label, defaultValue, hint, error, required };
  switch (kind) {
    case 'input':
      return <Input {...text} dir={dir} />;
    case 'password':
      return <PasswordInput {...text} />;
    case 'textarea':
      return <Textarea {...text} dir={dir} />;
    case 'time':
      return <TimeInput {...text} hourCycle={hourCycle} />;
    case 'otp':
      return <OtpInput {...text} />;
  }
}

/** How long a drawn submit stays busy. */
const SUBMIT_MS = 1500;

/** A complete form drawn in one state: fields, errors, summary and actions. */
export function Form({ title, summary, fields, submitLabel, cancelLabel, submitting }: FormData) {
  // A press of submit runs a drawn request: the button is busy as during the app's async submit.
  const [busy, setBusy] = useState(false);
  const rows: FormEntry[][] = [];
  for (const entry of fields) {
    const last = rows.at(-1);
    if (last?.length === 1 && last[0]?.half === true && entry.half === true) last.push(entry);
    else rows.push([entry]);
  }
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setTimeout(() => {
          setBusy(false);
        }, SUBMIT_MS);
      }}
    >
      {title !== undefined && <h3 className="m-0 text-heading-sm leading-heading">{title}</h3>}
      {summary !== undefined && (
        <div
          role="alert"
          className={cn(
            'flex items-start gap-2 rounded-surface border border-status-danger-border bg-status-danger-bg px-4 py-3',
            FIELD_TEXT.error,
          )}
        >
          <Icon name="warning" />
          <span>{summary}</span>
        </div>
      )}
      {rows.map((row) => (
        <div
          key={row.map((entry) => entry.label).join('|')}
          className={row.length === 2 ? 'grid grid-cols-2 gap-4' : 'flex flex-col'}
        >
          {row.map((entry) => (
            <div key={entry.label}>{control(entry)}</div>
          ))}
        </div>
      ))}
      <div className="flex justify-end gap-3">
        {cancelLabel !== undefined && <Button>{cancelLabel}</Button>}
        <Button type="submit" variant="primary" loading={submitting === true || busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
