// Select (slice 0.4-04), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Gate components · 0.4-04"): a field like an input with a caret at its
// logical end; the list below it, starting at its logical edge and at least as wide; 48 px rows
// (32 compact); the chosen option in the selection colour with a check at its start, so it is
// not told by colour alone; an unavailable option says why. Behaviour from UI SDK's Select:
// arrows, Home and End, typeahead (Arabic letters included), Enter chooses, Escape keeps the
// value, focus returns to the field. Typing matches the name without a title such as «د.».
import {
  Select as BaseSelect,
  SelectContent,
  SelectItem as BaseSelectItem,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
} from '@ui-sdk/react/select';
import type { ReactNode } from 'react';
import { FIELD_BOX, FieldShell } from '../field/field-shell.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { FLOATING_BOX } from '../popover/popover.tsx';

export interface SelectItem {
  value: string;
  label: string;
  /** Shown but not chosen; say why in `hint`. */
  disabled?: boolean | undefined;
  /** A short note at the end of the row («في إجازة»). */
  hint?: string | undefined;
}

export interface SelectProps {
  label: ReactNode;
  items: readonly SelectItem[];
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  onValueChange?: ((value: string | null) => void) | undefined;
  /** Shown while nothing is chosen («اختر الطبيب»). */
  placeholder?: string | undefined;
  hint?: ReactNode | undefined;
  /** An error from the form or the server: marks the field invalid and is read with it. */
  error?: ReactNode | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  name?: string | undefined;
  className?: string | undefined;
}

/** Titles that typing skips, so «س» finds «د. سامر» (Arabic and English forms). */
const TITLE = /^(?:د|أ|م|Dr|Mr|Mrs|Ms|Prof)\.\s*/u;

/** The text typeahead matches: the label without a leading title. */
export const typeaheadText = (label: string) => label.replace(TITLE, '');

const ITEM = cn(
  'flex min-h-(--shifa-size-row) cursor-pointer select-none items-center gap-2 rounded-input px-3 outline-none',
  'text-body leading-heading text-text-default in-data-[density=compact]:text-250',
  'data-highlighted:bg-selection-subtle data-selected:bg-selection-default data-selected:font-medium',
  'data-selected:data-highlighted:bg-selection-strong',
  'data-disabled:cursor-not-allowed data-disabled:bg-transparent data-disabled:text-text-disabled',
);

export function Select({
  label,
  items,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  hint,
  error,
  disabled,
  required,
  name,
  className,
}: SelectProps) {
  const labels = new Map(items.map((item) => [item.value, item.label]));
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      disabled={disabled}
      name={name}
      className={className}
    >
      <BaseSelect
        // Labels here are what typing matches; the trigger shows the full label from `labels`.
        items={items.map((item) => ({
          value: item.value,
          label: typeaheadText(item.label),
          disabled: item.disabled === true,
        }))}
        {...(value === undefined ? {} : { value })}
        {...(defaultValue === undefined ? {} : { defaultValue })}
        {...(placeholder === undefined ? {} : { placeholder })}
        {...(required === undefined ? {} : { required })}
        {...(onValueChange === undefined
          ? {}
          : {
              onValueChange: (next: unknown) => {
                onValueChange(typeof next === 'string' ? next : null);
              },
            })}
      >
        <SelectTrigger
          className={cn(FIELD_BOX, 'cursor-pointer justify-between px-3 text-start outline-none')}
        >
          <SelectValue className="min-w-0 flex-1 truncate data-placeholder:text-text-muted">
            {(state) =>
              state.placeholder
                ? (placeholder ?? '')
                : (labels.get(String(state.value)) ?? state.label)
            }
          </SelectValue>
          <Icon name="caret-down" className="text-icon-muted" />
        </SelectTrigger>
        <SelectContent
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className={cn(FLOATING_BOX, 'flex min-w-(--anchor-width) flex-col gap-0.5')}
        >
          {items.map((item) => (
            <BaseSelectItem
              key={item.value}
              value={item.value}
              label={typeaheadText(item.label)}
              {...(item.disabled === true ? { disabled: true } : {})}
              className={ITEM}
            >
              <span
                data-slot="select-check"
                className="inline-flex size-(--shifa-size-icon-sm) shrink-0"
              >
                <SelectItemIndicator>
                  <Icon name="check" />
                </SelectItemIndicator>
              </span>
              <span className="min-w-0 flex-1">{item.label}</span>
              {item.hint !== undefined && (
                <span className="ms-auto shrink-0 text-200 text-text-muted in-data-disabled:text-text-disabled">
                  {item.hint}
                </span>
              )}
            </BaseSelectItem>
          ))}
        </SelectContent>
      </BaseSelect>
    </FieldShell>
  );
}
