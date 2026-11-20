// Combobox (slice 0.4-04), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Gate components · 0.4-04"): a search field with a magnifier at its logical
// start and a clear button at its end; the list below it, starting at its logical edge; each
// suggestion shows the name, the typed part in bold (never a colour), and a muted second line;
// no match says so. Behaviour from UI SDK's Combobox: focus stays in the field, Up and Down move
// the highlight, Enter chooses, Escape closes. A name matches when one of its words starts with
// what was typed (the sheet's rule), Arabic included.
import {
  Combobox as BaseCombobox,
  ComboboxItem as BaseComboboxItem,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItemText,
  ComboboxList,
} from '@ui-sdk/react/combobox';
import { type ReactNode, useState } from 'react';
import { FIELD_BOX, FieldShell } from '../field/field-shell.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { FLOATING_BOX } from '../popover/popover.tsx';

export interface ComboboxItem {
  value: string;
  label: string;
  /** A muted second line («ملف 1042 · 34 سنة»). */
  description?: string | undefined;
  disabled?: boolean | undefined;
}

export interface ComboboxProps {
  label: ReactNode;
  items: readonly ComboboxItem[];
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  onValueChange?: ((value: string | null) => void) | undefined;
  /** What the list says when nothing matches («لا يوجد مريض بهذا الاسم»). */
  emptyMessage: ReactNode;
  placeholder?: string | undefined;
  /** The name of the clear button, for screen readers. */
  clearLabel?: string | undefined;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  disabled?: boolean | undefined;
  name?: string | undefined;
  className?: string | undefined;
}

/**
 * True when `query` starts at the start of a word of `label` (case-insensitive, runs of spaces as
 * one): «سا» and «سامر ال» both find «سامر الحلبي»; «امر» does not.
 */
export function matchesWordStart(label: string, query: string): boolean {
  const squash = (text: string) => text.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
  const q = squash(query);
  if (q === '') return true;
  return ` ${squash(label)}`.includes(` ${q}`);
}

const ITEM = cn(
  'flex min-h-(--shifa-size-row) cursor-pointer select-none flex-col items-start justify-center gap-0.5 rounded-input px-3 py-1',
  'text-body leading-heading text-text-default in-data-[density=compact]:text-250',
  'data-highlighted:bg-selection-subtle data-selected:bg-selection-default',
  'data-disabled:cursor-not-allowed data-disabled:text-text-disabled',
);

export function Combobox({
  label,
  items,
  value,
  defaultValue,
  onValueChange,
  emptyMessage,
  placeholder,
  clearLabel = 'مسح',
  hint,
  error,
  disabled,
  name,
  className,
}: ComboboxProps) {
  // The typed text, so only the matching items are rendered (UI SDK would keep the others in the
  // page, hidden), and the field box the list is placed against (not the bare input).
  const [query, setQuery] = useState('');
  const [field, setField] = useState<HTMLDivElement | null>(null);
  const shown = items.filter((item) => matchesWordStart(item.label, query));
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      disabled={disabled}
      name={name}
      className={className}
    >
      <BaseCombobox
        items={items.map((item) => ({
          value: item.value,
          label: item.label,
          disabled: item.disabled === true,
        }))}
        filter={(item: unknown, query: string) =>
          matchesWordStart((item as { label?: string }).label ?? String(item), query)
        }
        // Only typing narrows the list. UI SDK also sets the query to a chosen or controlled
        // item's label, and then shows every item: filtering by that label would empty the list.
        onQueryChange={(next: string, details: { reason: string }) => {
          setQuery(details.reason === 'input-change' ? next : '');
        }}
        {...(value === undefined ? {} : { value })}
        {...(defaultValue === undefined ? {} : { defaultValue })}
        {...(onValueChange === undefined
          ? {}
          : {
              onValueChange: (next: unknown) => {
                onValueChange(typeof next === 'string' ? next : null);
              },
            })}
      >
        <div ref={setField} data-slot="combobox-field" className={cn(FIELD_BOX, 'px-3')}>
          <Icon name="magnifying-glass" className="text-icon-muted" />
          <ComboboxInput
            {...(placeholder === undefined ? {} : { placeholder })}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-ui text-body leading-heading in-data-[density=compact]:text-250 text-inherit outline-none placeholder:text-text-muted"
          />
          <ComboboxClear
            aria-label={clearLabel}
            className="inline-flex size-(--shifa-size-control-sm) shrink-0 border-0 bg-transparent cursor-pointer items-center justify-center rounded-input text-icon-muted hover:bg-selection-subtle focus-visible:outline-2 focus-visible:outline-border-focus"
          >
            <Icon name="x" />
          </ComboboxClear>
        </div>
        <ComboboxContent
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          {...(field === null ? {} : { anchor: field })}
          // The panel itself is bare (no browser popover box); the list is the visible box, so it
          // is what lines up with the field. The empty message has a box of its own.
          className="m-0 min-w-(--anchor-width) overflow-visible border-0 bg-transparent p-0"
        >
          <ComboboxEmpty
            className={cn(FLOATING_BOX, 'px-3 py-2 text-250 leading-body text-text-muted')}
          >
            {emptyMessage}
          </ComboboxEmpty>
          <ComboboxList className={cn(FLOATING_BOX, 'flex flex-col gap-0.5 empty:hidden')}>
            {shown.map((item) => (
              <BaseComboboxItem
                key={item.value}
                value={item.value}
                label={item.label}
                {...(item.disabled === true ? { disabled: true } : {})}
                className={ITEM}
              >
                <ComboboxItemText className="min-w-0">
                  {(state) =>
                    state.segments.map((segment, index) =>
                      segment.match ? (
                        // biome-ignore lint/suspicious/noArrayIndexKey: segments have no id; their order is fixed
                        <strong key={index} className="font-bold">
                          {segment.text}
                        </strong>
                      ) : (
                        segment.text
                      ),
                    )
                  }
                </ComboboxItemText>
                {item.description !== undefined && (
                  <span className="text-200 leading-body text-text-muted">{item.description}</span>
                )}
              </BaseComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </BaseCombobox>
    </FieldShell>
  );
}
