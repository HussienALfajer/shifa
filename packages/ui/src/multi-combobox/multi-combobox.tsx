// MultiCombobox (A-02-01), as the owner approved the sheet on 2026-11-27 ("Shifa Screens · Admin
// web", page "Proposals", A02SheetMultiCombobox): Combobox for several choices, first for the
// clinics of a flag or an announcement. The chosen ones are chips inside the field, each with a
// remove button named by its choice; typing matches as Combobox does (a word starts with the
// typed text, through `foldArabic`, OD-40), the typed part in bold; the list stays open after
// each pick, with a tick on the chosen. Backspace in the empty field removes the last chip.
// Behaviour from UI SDK's Combobox with `multiple`; label, hint and error from FieldShell.
import {
  Combobox as BaseCombobox,
  ComboboxItem as BaseComboboxItem,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxList,
  ComboboxValue,
  createComboboxController,
} from '@ui-sdk/react/combobox';
import { type ReactNode, useEffect, useState } from 'react';
import { type ComboboxItem, matchesWordStart, resultsAnnouncement } from '../combobox/combobox.tsx';
import { FIELD_BOX, FieldShell } from '../field/field-shell.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { foldedMatch } from '../lib/fold-arabic.ts';
import { FLOATING_BOX } from '../popover/popover.tsx';
import { useDirection } from '../providers/direction-provider.tsx';

export interface MultiComboboxProps {
  label: ReactNode;
  items: readonly ComboboxItem[];
  /** The chosen values, controlled; or `defaultValue`. */
  value?: readonly string[] | undefined;
  defaultValue?: readonly string[] | undefined;
  onValueChange?: ((value: string[]) => void) | undefined;
  /** What the list says when nothing matches («لا عيادة بهذا الاسم»). */
  emptyMessage: ReactNode;
  placeholder?: string | undefined;
  /** The name of a chip's remove button: «إزالة …» in RTL, «Remove …» in LTR by default. */
  removeLabel?: ((label: string) => string) | undefined;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  disabled?: boolean | undefined;
  name?: string | undefined;
  open?: boolean | undefined;
  /** The list open at mount: to show it at rest, as the canvas does. */
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** The text in the field at mount, as if typed. */
  defaultInputValue?: string | undefined;
  className?: string | undefined;
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
  'flex min-h-(--shifa-size-row) cursor-pointer select-none items-center gap-2 rounded-input px-3 py-1',
  'text-body leading-heading text-text-default in-data-[density=compact]:text-250',
  'data-highlighted:bg-selection-subtle',
  'data-disabled:cursor-not-allowed data-disabled:text-text-disabled',
);

const CHIP = cn(
  'inline-flex h-7 max-w-full min-w-0 items-center gap-1 rounded-input bg-selection-default ps-2 pe-1',
  'text-data leading-heading text-text-default in-data-[density=compact]:h-6 in-data-[density=compact]:text-200',
);

const REMOVE = cn(
  'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-mark border-0 bg-transparent p-0 text-inherit',
  'hover:bg-selection-strong focus-visible:outline-2 focus-visible:outline-border-focus',
  'disabled:cursor-not-allowed disabled:hover:bg-transparent',
);

export function MultiCombobox({
  label,
  items,
  value,
  defaultValue,
  onValueChange,
  emptyMessage,
  placeholder,
  removeLabel,
  hint,
  error,
  disabled,
  name,
  open,
  defaultOpen,
  onOpenChange,
  defaultInputValue,
  className,
}: MultiComboboxProps) {
  const dir = useDirection();
  const remove = removeLabel ?? ((l: string) => (dir === 'ltr' ? `Remove ${l}` : `إزالة ${l}`));
  const [query, setQuery] = useState(defaultInputValue ?? '');
  const [field, setField] = useState<HTMLDivElement | null>(null);
  // The chosen values as shown (ticks): the controlled value, or our copy of the default.
  const [own, setOwn] = useState<readonly string[]>(defaultValue ?? []);
  const chosen = value ?? own;
  const labelOf = (v: string) => items.find((item) => item.value === v)?.label ?? v;
  const shown = items.filter((item) => matchesWordStart(item.label, query));
  const [controller] = useState(createComboboxController);
  const [initialText] = useState(defaultInputValue);
  useEffect(() => {
    if (initialText !== undefined && initialText !== '') {
      controller.setQuery(initialText, { reason: 'input-change' });
    }
  }, [controller, initialText]);
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
        multiple
        items={items.map((item) => ({
          value: item.value,
          label: item.label,
          disabled: item.disabled === true,
        }))}
        itemToLabel={labelOf}
        announcement={(change: { type: string; count?: number; loading?: boolean }) => {
          if (change.type === 'removed') return null;
          if (change.loading === true) return dir === 'ltr' ? 'Loading' : 'جارٍ التحميل';
          return resultsAnnouncement(change.count ?? 0, dir);
        }}
        filter={(item: unknown, q: string) =>
          matchesWordStart((item as { label?: string }).label ?? String(item), q)
        }
        onQueryChange={(next: string, details: { reason: string }) => {
          setQuery(details.reason === 'input-change' ? next : '');
        }}
        controller={controller}
        {...(disabled === true ? { disabled: true } : {})}
        {...(value === undefined ? {} : { value: [...value] })}
        {...(defaultValue === undefined ? {} : { defaultValue: [...defaultValue] })}
        {...(open === undefined ? {} : { open })}
        {...(defaultOpen === undefined ? {} : { defaultOpen })}
        {...(onOpenChange === undefined
          ? {}
          : {
              onOpenChange: (next: boolean) => {
                onOpenChange(next);
              },
            })}
        onValueChange={(next: unknown) => {
          const values = Array.isArray(next) ? next.map(String) : [];
          setOwn(values);
          onValueChange?.(values);
        }}
      >
        {/* UI SDK owns data-slot on its parts: the field box is our own element around them. */}
        <div ref={setField} data-slot="multi-combobox-field" className={cn(FIELD_BOX, 'px-3 py-1')}>
          <ComboboxChips className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <ComboboxValue>
              {() =>
                chosen.map((v) => (
                  <ComboboxChip key={v} value={v} className={CHIP}>
                    <span data-slot="multi-combobox-chip" className="min-w-0 truncate">
                      {labelOf(v)}
                    </span>
                    <ComboboxChipRemove
                      aria-label={remove(labelOf(v))}
                      {...(disabled === true ? { disabled: true } : {})}
                      className={REMOVE}
                    >
                      <Icon name="x" className="size-4" />
                    </ComboboxChipRemove>
                  </ComboboxChip>
                ))
              }
            </ComboboxValue>
            <ComboboxInput
              {...(placeholder === undefined ? {} : { placeholder })}
              className="h-8 min-w-(--shifa-width-37-5) flex-1 border-0 bg-transparent p-0 font-ui text-body leading-heading text-inherit outline-none placeholder:text-text-muted in-data-[density=compact]:text-250"
            />
          </ComboboxChips>
        </div>
        <ComboboxContent
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          {...(field === null ? {} : { anchor: field })}
          className="m-0 min-w-(--anchor-width) overflow-visible border-0 bg-transparent p-0"
        >
          <ComboboxEmpty
            className={cn(
              FLOATING_BOX,
              'px-3 py-2 text-250 leading-body text-text-muted empty:hidden',
            )}
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
                <span
                  data-slot="multi-combobox-tick"
                  aria-hidden="true"
                  className="inline-flex size-(--shifa-size-icon-sm) shrink-0 text-brand-primary"
                >
                  {chosen.includes(item.value) && <Icon name="check" />}
                </span>
                <span className="min-w-0">{marked(item.label, query)}</span>
              </BaseComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </BaseCombobox>
    </FieldShell>
  );
}
