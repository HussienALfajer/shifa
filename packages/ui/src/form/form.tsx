// Form (slice 0.4-05), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Inputs and forms · 0.4-05", last frame): a thin layer over React Hook Form
// with a Zod resolver, so a screen checks with the same schema as the server.
//
// - `useShifaForm(schema, options)`: React Hook Form, checked on submit and again on every change
//   after a failed submit.
// - `<Form form onSubmit translate>`: a Zod message is an i18n key («validation.required»); the
//   app's `translate` turns it into text, so no literal text lives in a schema. On a failed
//   submit nothing is sent and the first invalid field, in the order of the page, takes focus.
// - `<FormField name label? hint? required?>{(field) => <Input {...field} />}</FormField>`: with
//   a label it is a Field around the control; without one the control shows the error itself
//   (a checkbox or a radio group, which name themselves). Its text control is autocomplete="off"
//   unless the FormField names a token (OD-67, slice 0.4-12), passed through context.
// - `<FormSubmit>`: the primary submit Button, busy while an async submit runs (ignores presses).
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  type RefCallback,
  useContext,
  useRef,
} from 'react';
import {
  type FieldValues,
  FormProvider,
  type UseFormProps,
  type UseFormReturn,
  useController,
  useForm,
  useFormContext,
} from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '../button/button.tsx';
import { FIELD_TEXT, FieldAutoCompleteContext, FieldShell } from '../field/field-shell.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

/** Turns an i18n key (a Zod message) into the text to show. */
export type Translate = (key: string) => string;

/** A form made by `useShifaForm`: its input values and the values the schema parses to. */
export type ShifaForm<TInput extends FieldValues, TOutput = TInput> = UseFormReturn<
  TInput,
  unknown,
  TOutput
>;

/** React Hook Form with the schema as its resolver. */
export function useShifaForm<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
  options: Omit<UseFormProps<z.input<TSchema>, unknown, z.output<TSchema>>, 'resolver'> = {},
): ShifaForm<z.input<TSchema>, z.output<TSchema>> {
  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    // Focus is moved by Form, in the order of the page (React Hook Form uses its own order).
    shouldFocusError: false,
    ...options,
    resolver: zodResolver(schema as never) as never,
  });
}

const TranslateContext = createContext<Translate>((key) => key);

/** The first focusable part of an invalid field: a radio group's checked option, else its first. */
const FOCUS_ORDER = [
  '[role=radio][aria-checked=true]',
  '[role=radio]:not([data-disabled])',
  '[role=checkbox]:not([data-disabled])',
  '[role=switch]:not([data-disabled])',
  '[role=spinbutton]:not([data-disabled])',
  'textarea:not([disabled])',
  'input:not([type=hidden]):not([disabled]):not([tabindex="-1"]):not([aria-hidden=true])',
  // Anything else a person can Tab to (Select's trigger, a Combobox's button).
  'button:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
];

/** The paths of the invalid fields ("phone", "address.city"), from React Hook Form's errors. */
export function errorPaths(errors: object, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(errors) as [string, unknown][]) {
    if (typeof value !== 'object' || value === null) continue;
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if ('message' in value || 'type' in value) out.push(path);
    else out.push(...errorPaths(value, path));
  }
  return out;
}

function focusFirstInvalid(form: HTMLFormElement, invalid: readonly string[]): void {
  const fields = form.querySelectorAll<HTMLElement>('[data-form-field]');
  for (const field of fields) {
    const name = field.dataset['formField'] ?? '';
    if (!invalid.some((path) => path === name || path.startsWith(`${name}.`))) continue;
    for (const selector of FOCUS_ORDER) {
      const target = field.querySelector<HTMLElement>(selector);
      if (target !== null) {
        target.focus();
        return;
      }
    }
  }
}

export interface FormProps<TInput extends FieldValues, TOutput>
  extends Omit<ComponentProps<'form'>, 'onSubmit' | 'children' | 'noValidate' | 'translate'> {
  form: ShifaForm<TInput, TOutput>;
  /** Runs with the parsed values once every field is valid; a Promise keeps the submit busy. */
  onSubmit: (values: TOutput) => unknown;
  translate: Translate;
  /** A line above the fields after a failed submit, given the number of invalid fields. */
  errorSummary?: ((count: number) => ReactNode) | undefined;
  children: ReactNode;
}

export function Form<TInput extends FieldValues, TOutput>({
  form,
  onSubmit,
  translate,
  errorSummary,
  className,
  children,
  ...native
}: FormProps<TInput, TOutput>) {
  const element = useRef<HTMLFormElement>(null);
  const errorCount = errorPaths(form.formState.errors).length;
  const showSummary =
    errorSummary !== undefined && form.formState.submitCount > 0 && errorCount > 0;
  return (
    <TranslateContext.Provider value={translate}>
      <FormProvider {...form}>
        <form
          {...native}
          ref={element}
          noValidate
          className={cn('flex flex-col gap-4', className)}
          onSubmit={(event) => {
            void form.handleSubmit(
              async (values) => {
                await onSubmit(values);
              },
              (errors) => {
                const names = errorPaths(errors);
                // After the errors render, so the field is marked when it takes focus.
                requestAnimationFrame(() => {
                  if (element.current !== null) focusFirstInvalid(element.current, names);
                });
              },
            )(event);
          }}
        >
          {showSummary && (
            <div
              role="alert"
              className={cn(
                'flex items-start gap-2 rounded-surface border border-status-danger-border bg-status-danger-bg px-4 py-3',
                FIELD_TEXT.error,
              )}
            >
              <Icon name="warning" />
              <span>{errorSummary(errorCount)}</span>
            </div>
          )}
          {children}
        </form>
      </FormProvider>
    </TranslateContext.Provider>
  );
}

/** What a FormField hands its control. */
export interface FormFieldControl {
  name: string;
  // React Hook Form's value is not typed by field name; each control reads it as its own type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
  value: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the control's own value type
  onValueChange: (value: any) => void;
  onBlur: () => void;
  ref: RefCallback<unknown>;
  disabled?: boolean;
  /** The translated error, given only when the FormField has no label of its own. */
  error?: string | undefined;
  /** The FormField's hint and required mark, given only when it has no label of its own. */
  hint?: ReactNode;
  required?: boolean;
}

export interface FormFieldProps {
  name: string;
  /** With a label, the FormField is a Field around the control. */
  label?: ReactNode;
  hint?: ReactNode | undefined;
  required?: boolean | undefined;
  /**
   * Off by default (OD-67); an explicit token (`name`, `tel`, `bday`…) only on the patient's own
   * booking forms.
   */
  autoComplete?: string | undefined;
  className?: string | undefined;
  children: (field: FormFieldControl) => ReactNode;
}

export function FormField({
  name,
  label,
  hint,
  required,
  autoComplete,
  className,
  children,
}: FormFieldProps) {
  const translate = useContext(TranslateContext);
  const { control } = useFormContext();
  const { field, fieldState } = useController({ name, control });
  const message = fieldState.error?.message;
  const error = message === undefined || message === '' ? undefined : translate(message);
  const own = label !== undefined;
  const props: FormFieldControl = {
    name: field.name,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- React Hook Form's value is untyped by name
    value: field.value,
    onValueChange: field.onChange,
    onBlur: field.onBlur,
    ref: field.ref,
    ...(field.disabled === undefined ? {} : { disabled: field.disabled }),
    ...(own ? {} : { error }),
    ...(own || hint === undefined ? {} : { hint }),
    ...(own || required === undefined ? {} : { required }),
  };
  return (
    <div data-form-field={name} className={className}>
      <FieldAutoCompleteContext value={autoComplete}>
        {own ? (
          <FieldShell label={label} hint={hint} error={error} required={required}>
            {children(props)}
          </FieldShell>
        ) : (
          children(props)
        )}
      </FieldAutoCompleteContext>
    </div>
  );
}

export interface FormSubmitProps {
  children: ReactNode;
  className?: string | undefined;
}

/** The form's primary action; busy while the submit runs. */
export function FormSubmit({ children, className }: FormSubmitProps) {
  const { formState } = useFormContext();
  return (
    <Button
      type="submit"
      variant="primary"
      loading={formState.isSubmitting}
      {...(className === undefined ? {} : { className })}
    >
      {children}
    </Button>
  );
}
