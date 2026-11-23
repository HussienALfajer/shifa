// Combobox (slice 0.4-04), as the owner approved the sheet on 2026-11-20 ("Shifa Components
// (proposals)", page "Gate components · 0.4-04"): a search field with a magnifier at its logical
// start and a clear button at its end; the list below it, starting at its logical edge; each
// suggestion shows the name, the typed part in bold (never a colour), and a muted second line;
// no match says so. Behaviour from UI SDK's Combobox: focus stays in the field, Up and Down move
// the highlight, Enter chooses, Escape closes. A name matches when one of its words starts with
// what was typed (the sheet's rule), Arabic included. Slice 0.4-12 (OD-40): both sides are folded
// by `foldArabic`, so «احمد» finds «أحمد», «فاطمه» finds «فاطمة» and harakat do not matter; the
// typed part is marked through the same folding. The number of results is announced once typing
// pauses (UI SDK's `announcement`), in Arabic in RTL and in English in LTR.
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
import { foldArabic, foldedMatch } from '../lib/fold-arabic.ts';
import { FLOATING_BOX } from '../popover/popover.tsx';
import { type Direction, useDirection } from '../providers/direction-provider.tsx';

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
 * True when `query` starts at the start of a word of `label`, both folded by `foldArabic` (case,
 * harakat, alef forms, final ة and ى; runs of spaces as one): «سا» and «سامر ال» both find «سامر
 * الحلبي»; «امر» does not; «احمد» finds «أحمد».
 */
export function matchesWordStart(label: string, query: string): boolean {
  const squash = (text: string) =>
    foldArabic(text).trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
  const q = squash(query);
  if (q === '') return true;
  return ` ${squash(label)}`.includes(` ${q}`);
}

/**
 * What a screen reader hears once typing pauses: the number of results, with Arabic plural forms
 * in RTL («لا نتائج», «نتيجة واحدة», «نتيجتان», «3 نتائج», «11 نتيجة», «103 نتائج»: CLDR's
 * Arabic plural rules) and English in LTR.
 */
const ARABIC_PLURAL = new Intl.PluralRules('ar');

export function resultsAnnouncement(count: number, dir: Direction): string {
  if (dir === 'ltr') {
    if (count === 0) return 'No results';
    return count === 1 ? '1 result' : `${String(count)} results`;
  }
  switch (ARABIC_PLURAL.select(count)) {
    case 'zero':
      return 'لا نتائج';
    case 'one':
      return 'نتيجة واحدة';
    case 'two':
      return 'نتيجتان';
    case 'few':
      return `${String(count)} نتائج`;
    case 'many':
    case 'other':
      return `${String(count)} نتيجة`;
  }
}

/** The label with the typed part in bold, matched through the folding. */
function marked(label: string, query: string): ReactNode {
  const match = foldedMatch(label, query, { wordStart: true });
  if (match === null) return label;
  return (
    <>
      {label.slice(0, match.start)}
      <strong className="font-bold">{label.slice(match.start, match.end)}</strong>
      {label.slice(match.end)}
    </>
  );
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
  const dir = useDirection();
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
        announcement={(change: {
          type: string;
          count?: number;
          loading?: boolean;
          label?: string;
        }) => {
          if (change.type === 'removed') return null;
          if (change.loading === true) return dir === 'ltr' ? 'Loading' : 'جارٍ التحميل';
          return resultsAnnouncement(change.count ?? 0, dir);
        }}
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
          <Icon name="magnifying-glass" />
          <ComboboxInput
            {...(placeholder === undefined ? {} : { placeholder })}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-ui text-body leading-heading in-data-[density=compact]:text-250 text-inherit outline-none placeholder:text-text-muted"
          />
          <ComboboxClear
            aria-label={clearLabel}
            className="inline-flex size-(--shifa-size-control-sm) shrink-0 border-0 bg-transparent cursor-pointer items-center justify-center rounded-input text-inherit hover:bg-selection-subtle focus-visible:outline-2 focus-visible:outline-border-focus"
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
                <ComboboxItemText className="min-w-0">{marked(item.label, query)}</ComboboxItemText>
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
