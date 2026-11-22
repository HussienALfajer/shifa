// Command palette (slice 0.4-06), as the owner approved the sheet on 2026-11-22 ("Shifa
// Components (proposals)", page "Overlays and navigation · 0.4-06") with OD-63: one search over
// patients and actions. A modal panel 560 px wide near the top of the screen (radius 16, the modal
// shadow, the overlay colour behind); the search field with the lens at the logical start and an
// Esc key at the end; titled groups of options, the active one in the selection colour; a line of
// keyboard hints. Behaviour from UI SDK's Command inside UI SDK's Dialog: focus stays in the field
// (combobox over a listbox, aria-activedescendant), the up and down arrows move the active option,
// Enter runs it and closes, Escape clears the field then closes, focus returns to the trigger.
// Matching goes through `normalise` (case, diacritics, tatweel, alef forms by default; Phase A
// passes the name normaliser, ADR-0034). UI SDK marks matches with its own matcher, which does
// not fold Arabic, so the matched part is marked here with the same normaliser, in a <mark>.
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from '@ui-sdk/react/command';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@ui-sdk/react/dialog';
import { type ReactNode, useState } from 'react';
import { buttonClasses } from '../button/button.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { highlight, normaliseForSearch } from './normalise.ts';

export { normaliseForSearch } from './normalise.ts';

export interface CommandPaletteItem {
  value: string;
  label: string;
  /** A second line: a record number, a phone. It is searched too. */
  description?: string | undefined;
  icon?: IconName | undefined;
  /** More words that find it. */
  keywords?: readonly string[] | undefined;
  disabled?: boolean | undefined;
}

export interface CommandPaletteGroup {
  label: string;
  items: readonly CommandPaletteItem[];
}

export interface CommandPaletteProps {
  /** The dialog's name for screen readers («بحث وأوامر»). */
  title: string;
  /** The search field's name («ابحث عن مريض أو إجراء»); also its placeholder. */
  inputLabel: string;
  groups: readonly CommandPaletteGroup[];
  /** Runs the chosen option's value; the palette then closes. */
  onAction: (value: string) => unknown;
  /** What shows when nothing matches, for the typed text. */
  emptyText: (query: string) => ReactNode;
  /** Something to offer when nothing matches (a «تسجيل مريض جديد» button). */
  emptyAction?: ReactNode | undefined;
  /** How text is folded before it is compared; the default folds case, diacritics, tatweel, alef. */
  normalise?: ((text: string) => string) | undefined;
  /** A Button that opens it; leave out when the app opens it (a shortcut of the app shell). */
  triggerLabel?: string | undefined;
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** What screen readers hear after typing pauses. */
  resultsLabel?: ((count: number) => string) | undefined;
  /** The keyboard hints under the list. */
  hints?: { move: string; run: string; close: string } | undefined;
}

const HINTS = { move: 'تنقّل', run: 'فتح', close: 'إغلاق' };
const RESULTS = (count: number) => (count === 0 ? 'لا نتائج' : `${String(count)} نتيجة`);

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-mark border border-border-strong bg-bg-surface-raised px-1 font-ui text-caption leading-heading text-text-muted">
      {children}
    </kbd>
  );
}

export function CommandPalette({
  title,
  inputLabel,
  groups,
  onAction,
  emptyText,
  emptyAction,
  normalise = normaliseForSearch,
  triggerLabel,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  resultsLabel = RESULTS,
  hints = HINTS,
}: CommandPaletteProps) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const open = openProp ?? ownOpen;
  const setOpen = (next: boolean) => {
    setOwnOpen(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState('');
  const folded = normalise(query.trim());
  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      {triggerLabel !== undefined && (
        <DialogTrigger className={buttonClasses({ variant: 'secondary' })}>
          <Icon name="magnifying-glass" />
          <span className="min-w-0">{triggerLabel}</span>
        </DialogTrigger>
      )}
      <DialogContent
        className={cn(
          'fixed inset-x-4 top-1/6 bottom-auto m-0 mx-auto h-fit max-h-2/3 w-(--shifa-size-command) max-w-full',
          'flex flex-col overflow-hidden rounded-overlay bg-bg-surface p-0 text-text-default shadow-modal',
          'font-ui text-body leading-body backdrop:bg-bg-overlay',
          'transition duration-(--shifa-motion-duration-base) ease-enter',
          'data-starting-style:translate-y-2 data-starting-style:opacity-0',
          'data-ending-style:opacity-0 motion-reduce:transition-none motion-reduce:duration-0',
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <Command
          query={query}
          onQueryChange={(next: string) => {
            setQuery(next);
          }}
          filter={(item: { label: string; keywords?: string[] | undefined }) =>
            folded === '' ||
            normalise([item.label, ...(item.keywords ?? [])].join(' ')).includes(folded)
          }
          announcement={(change) => (change.type === 'results' ? resultsLabel(change.count) : null)}
          onAction={async (value: string) => {
            await onAction(value);
            setOpen(false);
            setQuery('');
          }}
          className="flex min-h-0 flex-col"
        >
          <div className="flex h-(--shifa-size-control-lg) shrink-0 items-center gap-3 border-b border-border-default px-4">
            <Icon name="magnifying-glass" className="text-icon-muted" />
            <CommandInput
              aria-label={inputLabel}
              placeholder={inputLabel}
              className="h-full min-w-0 flex-1 border-0 bg-transparent font-ui text-body-lg leading-heading text-text-default outline-none placeholder:text-text-muted"
            />
            <Key>Esc</Key>
          </div>
          <CommandEmpty className="flex flex-col items-center gap-3 px-6 py-8 text-center data-empty:flex not-data-empty:hidden">
            <span className="text-body font-medium leading-heading">{emptyText(query)}</span>
            {emptyAction}
          </CommandEmpty>
          <CommandList className="min-h-0 overflow-y-auto p-2 empty:hidden">
            {groups.map((group) => (
              <CommandGroup key={group.label} className="flex flex-col">
                <CommandGroupLabel className="px-2 pt-2 pb-1 text-200 font-medium leading-heading text-text-muted">
                  {group.label}
                </CommandGroupLabel>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    label={item.label}
                    // The second line (a record number, a phone) finds the option too.
                    keywords={[
                      ...(item.keywords ?? []),
                      ...(item.description === undefined ? [] : [item.description]),
                    ]}
                    {...(item.disabled === undefined ? {} : { disabled: item.disabled })}
                    className={cn(
                      'flex min-h-(--shifa-size-row) cursor-pointer items-center gap-3 rounded-input px-2 py-1',
                      'data-highlighted:bg-selection-default data-disabled:cursor-not-allowed data-disabled:text-text-disabled',
                      'in-data-[density=compact]:gap-2 in-data-[density=compact]:text-200',
                    )}
                  >
                    {item.icon !== undefined && (
                      <Icon name={item.icon} className="text-icon-muted" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span>{highlight(item.label, query, normalise)}</span>
                      {item.description !== undefined && (
                        <span className="text-200 leading-heading text-text-muted tabular-nums">
                          {item.description}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        <div
          aria-hidden="true"
          className="flex shrink-0 items-center gap-4 border-t border-border-default px-4 py-2 text-caption leading-heading text-text-muted"
        >
          <span className="inline-flex items-center gap-1">
            <Key>↑</Key>
            <Key>↓</Key>
            {hints.move}
          </span>
          <span className="inline-flex items-center gap-1">
            <Key>Enter</Key>
            {hints.run}
          </span>
          <span className="inline-flex items-center gap-1">
            <Key>Esc</Key>
            {hints.close}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
