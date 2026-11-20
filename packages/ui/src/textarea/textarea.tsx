// Textarea (slice 0.4-05), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Inputs and forms · 0.4-05"): Input's box, at least 104 px high and growing
// with its text; Enter adds a line; with a limit, a «n / max» counter in Western digits at the
// logical end under it. Behaviour from UI SDK's Textarea.
import { Textarea as BaseTextarea } from '@ui-sdk/react/textarea';
import { type ComponentProps, type ReactNode, type Ref, useState } from 'react';
import { FIELD_BOX, FIELD_TEXT, useFieldShell, WithField } from '../field/field-shell.tsx';
import { cn } from '../lib/cn.ts';

type NativeTextarea = Omit<
  ComponentProps<'textarea'>,
  | 'className'
  | 'style'
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'dir'
  | 'children'
  | 'ref'
  | 'disabled'
  | 'required'
  | 'onSubmit'
>;

export interface TextareaProps extends NativeTextarea {
  label?: ReactNode;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  dir?: 'auto' | 'ltr' | 'rtl' | undefined;
  /** A limit; shows the «n / max» counter. */
  maxLength?: number | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  ref?: Ref<HTMLTextAreaElement> | undefined;
  className?: string | undefined;
}

export function Textarea({
  label,
  hint,
  error,
  value,
  defaultValue,
  onValueChange,
  maxLength,
  disabled,
  required,
  name,
  className,
  ...native
}: TextareaProps) {
  const field = useFieldShell();
  const isRequired = required ?? field?.required;
  const isDisabled = disabled ?? field?.disabled;
  const [own, setOwn] = useState(defaultValue ?? '');
  const length = (value ?? own).length;
  return (
    <WithField
      label={label}
      hint={hint}
      error={error}
      required={isRequired}
      disabled={isDisabled}
      className={className}
    >
      <div data-focus-ring="" className={cn(FIELD_BOX, 'items-stretch px-3 py-3')}>
        <BaseTextarea
          {...native}
          autoResize
          {...(name === undefined ? {} : { name })}
          {...(value === undefined ? {} : { value })}
          {...(defaultValue === undefined ? {} : { defaultValue })}
          {...(maxLength === undefined ? {} : { maxLength })}
          {...(isRequired === true ? { required: true } : {})}
          {...(isDisabled === true ? { disabled: true } : {})}
          onValueChange={(next: string) => {
            setOwn(next);
            onValueChange?.(next);
          }}
          className={cn(
            'min-h-16 w-full min-w-0 resize-none border-0 bg-transparent p-0 font-ui text-body leading-body text-inherit outline-none',
            'in-data-[density=compact]:text-250 in-data-[density=compact]:leading-body placeholder:text-text-muted disabled:cursor-not-allowed',
          )}
        />
      </div>
      {maxLength !== undefined && (
        <span
          aria-hidden="true"
          className={cn(FIELD_TEXT.hint, 'self-end tabular-nums')}
        >{`${String(length)} / ${String(maxLength)}`}</span>
      )}
    </WithField>
  );
}
