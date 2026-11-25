// Select (slice 0.4-04), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Gate components · 0.4-04"): a field like an input with a caret at its
// logical end; the list below it, starting at its logical edge and at least as wide; 48 px rows
// (32 compact); the chosen option in the selection colour with a check at its start, so it is
// not told by colour alone; an unavailable option says why. Behaviour from UI SDK's Select:
// arrows, Home and End, typeahead (Arabic letters included), Enter chooses, Escape keeps the
// value, focus returns to the field. Typing matches the name without a title such as «د.».
// Slice 0.4-12 (OD-40): typeahead matches through `foldArabic`. UI SDK's typeahead compares the
// typed key with each item's `label` through its own folding, which keeps hamza forms apart, so
// the labels it gets are folded and so is the typed key (a capture-phase handler hands UI SDK the
// folded key instead). The option and the trigger still show the label as written.
import {
  Select as BaseSelect,
  SelectItem as BaseSelectItem,
  SelectContent,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
} from '@ui-sdk/react/select';
import type { KeyboardEvent, ReactNode } from 'react';
import { FIELD_BOX_SELF, FieldShell } from '../field/field-shell.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { foldArabic } from '../lib/fold-arabic.ts';
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
  /** The list open or closed, controlled; with `onOpenChange`. */
  open?: boolean | undefined;
  /** The list open at mount (closed by default): to show it at rest, as the canvas does. */
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  className?: string | undefined;
}

/** Titles that typing skips, so «س» finds «د. سامر» (Arabic and English forms). */
const TITLE = /^(?:د|أ|م|Dr|Mr|Mrs|Ms|Prof)\.\s*/u;

/** The text typeahead matches: the label without a leading title, folded (OD-40). */
export const typeaheadText = (label: string) => foldArabic(label.replace(TITLE, ''));

/**
 * Hands typeahead the folded key: «أ» arrives as «ا», «ة» as «ه», «٣» as «3». The original event
 * stops before UI SDK sees it and the same key, folded, is sent to the same element. A key that
 * folds to itself, or to nothing (a haraka), goes through as it is.
 */
function foldTypedKey(event: KeyboardEvent<HTMLElement>) {
  const { key, ctrlKey, metaKey, altKey } = event;
  if (key.length !== 1 || ctrlKey || metaKey || altKey) return;
  const folded = foldArabic(key);
  if (folded === key || folded.length !== 1) return;
  event.preventDefault();
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
  event.target.dispatchEvent(
    new globalThis.KeyboardEvent('keydown', {
      key: folded,
      bubbles: true,
      cancelable: true,
      shiftKey: event.shiftKey,
    }),
  );
}

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
  open,
  defaultOpen,
  onOpenChange,
  className,
}: SelectProps) {
  const labels = new Map(items.map((item) => [item.value, item.label]));
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
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
        {...(open === undefined ? {} : { open })}
        {...(defaultOpen === undefined ? {} : { defaultOpen })}
        {...(onOpenChange === undefined
          ? {}
          : {
              onOpenChange: (next: boolean) => {
                onOpenChange(next);
              },
            })}
        {...(onValueChange === undefined
          ? {}
          : {
              onValueChange: (next: unknown) => {
                onValueChange(typeof next === 'string' ? next : null);
              },
            })}
      >
        <SelectTrigger
          onKeyDownCapture={foldTypedKey}
          className={cn(
            FIELD_BOX_SELF,
            'cursor-pointer justify-between px-3 text-start outline-none',
          )}
        >
          <SelectValue className="min-w-0 flex-1 truncate data-placeholder:text-text-muted">
            {(state) =>
              state.placeholder
                ? (placeholder ?? '')
                : (labels.get(String(state.value)) ?? state.label)
            }
          </SelectValue>
          <Icon name="caret-down" />
        </SelectTrigger>
        <SelectContent
          onKeyDownCapture={foldTypedKey}
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
