// Switch (slice 0.4-05), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Inputs and forms · 0.4-05"): for a setting that acts at once. A 44 × 24
// track at the logical start of the line; off, grey with the thumb at the start; on, green with
// the thumb at the logical end (the left in Arabic) and a tick in it. Behaviour from UI SDK's
// Switch: Space toggles, Enter never does. A switch takes no error message: a failed save turns
// it back and the screen says why.
import { Field, FieldDescription } from '@ui-sdk/react/field';
import { Switch as BaseSwitch, SwitchThumb } from '@ui-sdk/react/switch';
import type { ReactNode, Ref } from 'react';
import { CHOICE_LINE } from '../checkbox/checkbox.tsx';
import { FIELD_TEXT, useFieldShell } from '../field/field-shell.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

export interface SwitchProps {
  /** The text after the track; it names the switch. */
  children: ReactNode;
  checked?: boolean | undefined;
  defaultChecked?: boolean | undefined;
  onCheckedChange?: ((checked: boolean) => void) | undefined;
  /** A line under the text, read with it. */
  description?: ReactNode | undefined;
  disabled?: boolean | undefined;
  name?: string | undefined;
  value?: string | undefined;
  onBlur?: (() => void) | undefined;
  ref?: Ref<HTMLButtonElement> | undefined;
  className?: string | undefined;
}

export function Switch({
  children,
  checked,
  defaultChecked,
  onCheckedChange,
  description,
  disabled,
  name,
  value,
  onBlur,
  ref,
  className,
}: SwitchProps) {
  const field = useFieldShell();
  const isDisabled = disabled ?? field?.disabled;
  const line = (
    <label className={CHOICE_LINE}>
      <BaseSwitch
        {...(ref === undefined ? {} : { ref })}
        {...(checked === undefined ? {} : { checked })}
        {...(defaultChecked === undefined ? {} : { defaultChecked })}
        {...(isDisabled === true ? { disabled: true } : {})}
        {...(name === undefined ? {} : { name })}
        {...(value === undefined ? {} : { value })}
        {...(onBlur === undefined ? {} : { onBlur })}
        onCheckedChange={(next: boolean) => onCheckedChange?.(next)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-pill border-0 p-0.5',
          'bg-border-strong data-checked:bg-brand-primary',
          'transition-colors duration-(--shifa-motion-duration-fast) motion-reduce:transition-none',
          'hover:ring-6 hover:ring-selection-subtle',
          'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus focus-visible:transition-none',
          'data-disabled:cursor-not-allowed data-disabled:bg-border-default data-disabled:hover:ring-0',
        )}
      >
        <SwitchThumb
          className={cn(
            'inline-flex size-5 items-center justify-center rounded-pill bg-bg-surface text-brand-primary shadow-card',
            'transition-transform duration-(--shifa-motion-duration-fast) motion-reduce:transition-none',
            // The logical end: right in English, left in Arabic.
            'data-checked:translate-x-5 rtl:data-checked:-translate-x-5',
            'data-disabled:bg-bg-surface-raised data-disabled:text-text-disabled data-disabled:shadow-none',
          )}
        >
          {/* UI SDK owns the thumb's data-slot; this span fills the thumb and names it. */}
          {(state: { checked?: boolean }) => (
            <span data-slot="thumb" className="inline-flex size-full items-center justify-center">
              {state.checked === true && <Icon name="check" className="size-3" />}
            </span>
          )}
        </SwitchThumb>
      </BaseSwitch>
      <span className="py-2 in-data-[density=compact]:py-1">{children}</span>
    </label>
  );
  const described = description !== undefined && (
    <FieldDescription className={cn(FIELD_TEXT.hint, '-mt-2 ps-13')}>
      {description}
    </FieldDescription>
  );
  if (description === undefined && className === undefined) return line;
  // Inside an outer Field (a form field) that Field reads the description.
  if (field !== null) {
    return (
      <div className={cn('flex flex-col', className)}>
        {line}
        {described}
      </div>
    );
  }
  return (
    <Field
      {...(isDisabled === true ? { disabled: true } : {})}
      className={cn('flex flex-col', className)}
    >
      {line}
      {described}
    </Field>
  );
}
