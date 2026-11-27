// EditableList (A-03-01), as the owner approved the sheet on 2026-11-27 ("Shifa Screens · Clinic
// web", page "Proposals", A03SheetEditableList): a short list a person edits in place, a choice
// field's choices first. A group named by its label with the count against the maximum; each row
// a list item, numbered among the active ones, renamed in place (an Input with its error; Enter
// saves, Escape cancels), moved up or down, archived (never deleted, at once and without a
// question: the caller shows «أُرشف …» with «تراجع») or restored; how many charts hold it; the add
// line (Enter adds) with its error. A name is refused when it folds (hamza, taa marbuta) to one
// already there, as search folds it. Read-only shows no tools and no add line. The server stays the
// judge of the limit; the component only shows it before sending.
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Badge } from '../badge/badge.tsx';
import { Button } from '../button/button.tsx';
import { IconButton } from '../icon-button/icon-button.tsx';
import type { IconName } from '../icons/icon.tsx';
import { Input } from '../input/input.tsx';
import { cn } from '../lib/cn.ts';
import { foldArabic } from '../lib/fold-arabic.ts';
import { useDirection } from '../providers/direction-provider.tsx';
import { EDITABLE_WORDS, type EditableListWords } from './words.ts';

export type { EditableListWords } from './words.ts';

export interface EditableListItem {
  id: string;
  label: string;
  /** How many records hold it («في 41 ملفًا»). */
  use?: ReactNode;
  /** Archived: kept on the records that hold it, not offered; restored, never deleted. */
  archived?: boolean | undefined;
}

export interface EditableListProps {
  /** Names the group and shows above the list («خيارات «جهة الإحالة»»). */
  label: string;
  items: readonly EditableListItem[];
  /** The most active items allowed; at it the add line is refused with `words.full`. */
  max: number;
  readOnly?: boolean | undefined;
  onMove?: ((id: string, direction: 'up' | 'down') => void) | undefined;
  onRename?: ((id: string, label: string) => void) | undefined;
  onArchive?: ((id: string) => void) | undefined;
  onRestore?: ((id: string) => void) | undefined;
  onAdd?: ((label: string) => void) | undefined;
  /** An error of the whole list under the add line («يحتاج خيارين على الأقل»). */
  addError?: ReactNode;
  /** The note under the list; by default, how archived items behave when there are some. */
  foot?: ReactNode;
  /** Replaces any of the words (English comes with the direction). */
  words?: Partial<EditableListWords> | undefined;
  className?: string | undefined;
}

type Tool = 'up' | 'down' | 'rename' | 'archive' | 'restore';

/** A row: its number, the text (or the rename field), the tools. */
const ROW = { gridTemplateColumns: 'auto minmax(0, 1fr) auto' } as const;
/** The add line: the field, then its button. */
const ADD = { gridTemplateColumns: 'minmax(0, 1fr) auto' } as const;

export function EditableList({
  label,
  items,
  max,
  readOnly = false,
  onMove,
  onRename,
  onArchive,
  onRestore,
  onAdd,
  addError,
  foot,
  className,
  ...props
}: EditableListProps) {
  const words = { ...EDITABLE_WORDS[useDirection()], ...props.words };
  const active = items.filter((i) => !i.archived);
  const archivedCount = items.length - active.length;
  const full = active.length >= max;
  const root = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<{ id: string; draft: string; error?: string } | null>(
    null,
  );
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | undefined>(undefined);
  // The control to focus once the list has re-rendered (a moved row, a closed rename).
  const refocus = useRef<{ id: string; tool: Tool } | null>(null);
  useLayoutEffect(() => {
    const target = refocus.current;
    if (target === null) return;
    refocus.current = null;
    root.current
      ?.querySelector<HTMLElement>(
        `[data-row="${CSS.escape(target.id)}"] [data-tool="${target.tool}"]`,
      )
      ?.focus();
  });

  /** The existing label `text` folds to, other than item `except`. */
  const duplicate = (text: string, except?: string) => {
    const folded = foldArabic(text.trim());
    return items.find((i) => i.id !== except && foldArabic(i.label.trim()) === folded)?.label;
  };

  const saveRename = () => {
    if (editing === null) return;
    const text = editing.draft.trim();
    const item = items.find((i) => i.id === editing.id);
    if (text === '' || text === item?.label) {
      closeRename();
      return;
    }
    const taken = duplicate(text, editing.id);
    if (taken !== undefined) {
      setEditing({ ...editing, error: words.renameDuplicate(taken) });
      return;
    }
    onRename?.(editing.id, text);
    closeRename();
  };
  const closeRename = () => {
    if (editing !== null) refocus.current = { id: editing.id, tool: 'rename' };
    setEditing(null);
  };

  const add = () => {
    const text = draft.trim();
    if (text === '' || full) return;
    const taken = duplicate(text);
    if (taken !== undefined) {
      setDraftError(words.addDuplicate(taken));
      return;
    }
    onAdd?.(text);
    setDraft('');
    setDraftError(undefined);
  };

  let position = 0;
  const shownFoot = foot ?? (archivedCount > 0 ? words.archivedFoot(archivedCount) : undefined);
  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      data-slot="editable-list"
      className={cn('flex flex-col gap-2 font-ui text-text-default', className)}
    >
      <div className="flex items-baseline gap-2">
        <span aria-hidden="true" className="flex-1 text-data font-medium leading-body">
          {label}
        </span>
        <span
          data-slot="editable-count"
          className={cn(
            'text-caption leading-body tabular-nums',
            full ? 'font-semibold text-status-warning-fg' : 'text-text-muted',
          )}
        >
          {words.count(active.length, max)}
        </span>
      </div>
      {items.length > 0 && (
        // biome-ignore lint/a11y/noRedundantRoles: `list-none` drops the list role in Safari; keep it said
        <ul
          role="list"
          className="m-0 flex list-none flex-col rounded-input border border-border-default bg-bg-surface p-0"
        >
          {items.map((item) => {
            const live = !item.archived;
            if (live) position += 1;
            const first = live && position === 1;
            const last = live && position === active.length;
            const isEditing = live && editing?.id === item.id;
            return (
              // biome-ignore lint/a11y/noRedundantRoles: as the list above, for Safari
              <li
                key={item.id}
                role="listitem"
                data-row={item.id}
                style={ROW}
                className={cn(
                  'grid items-start gap-2 p-2 in-data-[density=compact]:p-1',
                  'not-first:border-t not-first:border-border-default',
                  !live && 'bg-bg-surface-raised',
                )}
              >
                <span
                  data-slot="editable-number"
                  className="inline-flex h-(--shifa-size-control-md) min-w-7 items-center justify-center text-caption text-text-muted tabular-nums"
                >
                  {live ? String(position) : ''}
                </span>
                {isEditing ? (
                  <Input
                    label={words.editLabel}
                    value={editing.draft}
                    autoFocus
                    error={editing.error}
                    onValueChange={(value) => {
                      setEditing({ id: item.id, draft: value });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        saveRename();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        event.stopPropagation();
                        closeRename();
                      }
                    }}
                  />
                ) : (
                  <span className="flex min-h-(--shifa-size-control-md) flex-wrap items-center gap-x-2 text-data leading-body">
                    <span
                      data-slot="editable-label"
                      className={cn(!live && 'text-text-muted line-through')}
                    >
                      {item.label}
                    </span>
                    {item.use !== undefined && (
                      <span className="text-caption text-text-muted tabular-nums">{item.use}</span>
                    )}
                    {!live && (
                      <Badge tone="neutral" icon="archive">
                        {words.archived}
                      </Badge>
                    )}
                  </span>
                )}
                {!readOnly && (
                  <span className="flex min-h-(--shifa-size-control-md) items-center gap-1">
                    {live ? (
                      <>
                        <RowTool
                          tool="up"
                          icon="caret-up"
                          label={words.up(item.label)}
                          at={first}
                          onPress={() => {
                            refocus.current = { id: item.id, tool: 'up' };
                            onMove?.(item.id, 'up');
                          }}
                        />
                        <RowTool
                          tool="down"
                          icon="caret-down"
                          label={words.down(item.label)}
                          at={last}
                          onPress={() => {
                            refocus.current = { id: item.id, tool: 'down' };
                            onMove?.(item.id, 'down');
                          }}
                        />
                        <RowTool
                          tool="rename"
                          icon="pencil"
                          label={words.rename(item.label)}
                          at={false}
                          onPress={() => {
                            setEditing({ id: item.id, draft: item.label });
                          }}
                        />
                        <RowTool
                          tool="archive"
                          icon="archive"
                          label={words.archive(item.label)}
                          at={false}
                          tooltip
                          onPress={() => {
                            onArchive?.(item.id);
                          }}
                        />
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        data-tool="restore"
                        aria-label={words.restoreItem(item.label)}
                        onClick={() => {
                          refocus.current = { id: item.id, tool: 'archive' };
                          onRestore?.(item.id);
                        }}
                      >
                        {words.restore}
                      </Button>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!readOnly && (
        <div style={ADD} className="grid items-end gap-2">
          <Input
            label={words.addLabel}
            placeholder={words.addPlaceholder}
            value={draft}
            error={full ? words.full(max) : (draftError ?? addError)}
            onValueChange={(value) => {
              setDraft(value);
              setDraftError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
          />
          <Button variant="secondary" startIcon="plus" disabled={full} onClick={add}>
            {words.add}
          </Button>
        </div>
      )}
      {readOnly && addError !== undefined && (
        <p className="m-0 text-caption text-text-muted">{addError}</p>
      )}
      {shownFoot !== undefined && shownFoot !== '' && (
        <p className="m-0 text-caption leading-body text-text-muted">{shownFoot}</p>
      )}
    </div>
  );
}

/**
 * A row's small tool. At an end it stays focusable and says so (`aria-disabled`), as the
 * PageBanner's pager does: a native `disabled` would drop the keyboard's focus after a move.
 */
function RowTool({
  tool,
  icon,
  label,
  at,
  tooltip = false,
  onPress,
}: {
  tool: Tool;
  icon: IconName;
  label: string;
  at: boolean;
  tooltip?: boolean;
  onPress: () => void;
}) {
  return (
    <IconButton
      data-tool={tool}
      icon={icon}
      variant="ghost"
      size="sm"
      label={label}
      tooltip={tooltip}
      aria-disabled={at || undefined}
      className="aria-disabled:cursor-not-allowed aria-disabled:bg-transparent aria-disabled:text-text-disabled"
      onClick={() => {
        if (!at) onPress();
      }}
    />
  );
}
