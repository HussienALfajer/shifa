// RecordList (A-03-01), as the owner approved the sheet on 2026-11-27 ("Shifa Screens · Clinic
// web", page "Proposals", A03SheetRecordList, with the type icon and row tools added at checkpoint
// 2): rows of people or records, for search results, a family, duplicate candidates, treating
// doctors, the recently opened and a clinic's fields. Three layouts (a table with the DataTable's
// header and row heights, two lines, tiles), sizes md and sm, both densities. A table narrower than
// 640 px (a phone, a panel) shows as two lines. The links share one Tab stop; ↑ ↓ move between
// rows, Home and End to the first and last, Enter opens; a row with its own buttons keeps them in
// the Tab order and its first one is where the arrows land.
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { EmptyState } from '../empty-state/empty-state.tsx';
import type { IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { useDirection } from '../providers/direction-provider.tsx';
import { Skeleton, SkeletonText } from '../skeleton/skeleton.tsx';
import { isLink, RecordRow, type RowContext, share, TITLE_SHARE } from './record-list-row.tsx';
import type {
  RecordListColumn,
  RecordListItem,
  RecordListLayout,
  RecordListSize,
} from './types.ts';

export type {
  RecordListCell,
  RecordListColumn,
  RecordListDetail,
  RecordListItem,
  RecordListLayout,
  RecordListSize,
  RecordListTool,
} from './types.ts';

export interface RecordListProps {
  /** Names the list («نتائج البحث»). */
  'aria-label': string;
  items: readonly RecordListItem[];
  layout?: RecordListLayout | undefined;
  size?: RecordListSize | undefined;
  /** The table layout's columns, one per cell of each row. */
  columns?: readonly RecordListColumn[] | undefined;
  /** The title column's header in the table layout («المريض»). */
  titleHeader?: string | undefined;
  /** A bordered surface (default); off inside a card that already frames it. */
  framed?: boolean | undefined;
  /** A chevron at the end of link rows (default). */
  chevron?: boolean | undefined;
  loading?: boolean | undefined;
  loadingRows?: number | undefined;
  loadingLabel?: string | undefined;
  /** Shown when there are no items. */
  empty?: { title: ReactNode; description?: ReactNode; icon?: IconName | undefined } | undefined;
  /** A line under the rows («5 نتائج، الأقرب أولًا»). */
  footer?: ReactNode;
  /**
   * A link row was clicked or opened with Enter; call `event.preventDefault()` to navigate in the
   * app instead of loading the page.
   */
  onOpen?: ((id: string, event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
  className?: string | undefined;
}

const WORDS = {
  rtl: { loading: 'جارٍ التحميل', locked: 'مخفي عنك' },
  ltr: { loading: 'Loading', locked: 'Hidden from you' },
} as const;

const TILES = {
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(var(--shifa-width-60), 100%), 1fr))',
} as const;

/** Where the arrows land in each row: its link, or its first control that can be pressed. */
function targets(body: HTMLElement): HTMLElement[] {
  return [...body.querySelectorAll<HTMLElement>('[data-slot="record-row"]')]
    .map((row) =>
      row.querySelector<HTMLElement>(
        'a[data-record-nav], button:not([disabled]):not([aria-disabled="true"])',
      ),
    )
    .filter((el): el is HTMLElement => el !== null);
}

export function RecordList({
  items,
  layout = 'table',
  size = 'md',
  columns = [],
  titleHeader,
  framed = true,
  chevron = true,
  loading = false,
  loadingRows = 3,
  loadingLabel,
  empty,
  footer,
  onOpen,
  className,
  ...props
}: RecordListProps) {
  const words = WORDS[useDirection()];
  const body = useRef<HTMLDivElement>(null);
  const linkIds = items.filter(isLink).map((i) => i.id);
  const [active, setActive] = useState<string | null>(null);
  const tabStop = active !== null && linkIds.includes(active) ? active : (linkIds[0] ?? null);
  const table = layout === 'table' && columns.length > 0;
  const small = size === 'sm';
  const ctx: RowContext = {
    table,
    tiles: layout === 'tiles',
    small,
    chevron,
    columns,
    lockedLabel: words.locked,
    tabStop,
    onLinkFocus: setActive,
    onToolPress: (id, tool) => {
      pressed.current = { id, tool };
    },
    onOpen,
  };
  // A tool that moves its row (the caller reorders the items) re-inserts the row's node, which
  // drops the focus: after the render, it goes back to the same tool of the same row.
  const pressed = useRef<{ id: string; tool: string } | null>(null);
  useLayoutEffect(() => {
    const last = pressed.current;
    if (last === null) return;
    pressed.current = null;
    // Only when the focus was dropped (on the page's body), never taken from where it went since.
    const owner = body.current?.ownerDocument;
    if (owner === undefined || (owner.activeElement !== null && owner.activeElement !== owner.body))
      return;
    body.current
      ?.querySelector<HTMLElement>(
        `[data-id="${CSS.escape(last.id)}"] [data-tool="${CSS.escape(last.tool)}"]`,
      )
      ?.focus();
  });

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (body.current === null) return;
    const list = targets(body.current);
    const at = list.findIndex(
      (el) =>
        el === document.activeElement ||
        el.closest('[data-slot="record-row"]')?.contains(document.activeElement ?? null),
    );
    const next: Record<string, number> = {
      ArrowDown: at + 1,
      ArrowUp: at - 1,
      Home: 0,
      End: list.length - 1,
    };
    const to = next[event.key];
    // Arrows inside a text field of a row (none today) and keys elsewhere stay with it.
    if (to === undefined || at === -1) return;
    event.preventDefault();
    list[Math.min(Math.max(to, 0), list.length - 1)]?.focus();
  };

  const showRows = !loading && items.length > 0;
  const emptyShown = !loading && items.length === 0 && empty !== undefined;
  return (
    <div
      className={cn(
        '@container flex min-w-0 flex-col font-ui text-text-default',
        framed &&
          'overflow-hidden rounded-(--shifa-card-radius) border border-border-default bg-bg-surface',
        className,
      )}
    >
      <div
        // Empty, it holds the EmptyState's heading, which a list may not: a named group then.
        role={emptyShown ? 'group' : 'list'}
        aria-label={props['aria-label']}
        aria-busy={loading || undefined}
        data-slot="record-list"
        className="flex min-w-0 flex-col"
      >
        {table && showRows && (
          <div
            aria-hidden="true"
            data-slot="record-list-head"
            className={cn(
              'hidden min-h-(--shifa-table-row-height) items-center border-b border-border-default bg-bg-surface-raised @record-table:flex',
              'text-caption font-medium leading-heading text-text-muted',
              small ? 'gap-3 px-3' : 'gap-4 px-4',
            )}
          >
            <span
              className={cn(
                'shrink-0',
                small ? 'w-(--shifa-size-avatar-sm)' : 'w-(--shifa-size-avatar-md)',
              )}
            />
            <span style={share(TITLE_SHARE)} className="min-w-0 truncate">
              {titleHeader}
            </span>
            {columns.map((column) => (
              <span
                key={column.header}
                style={share(column.weight ?? 1)}
                className="min-w-0 truncate"
              >
                {column.header}
              </span>
            ))}
            {chevron && items.some(isLink) && (
              <span className="w-(--shifa-size-icon-sm) shrink-0" />
            )}
          </div>
        )}
        {loading && (
          <div className="flex flex-col gap-4 p-4">
            <span className="sr-only">{loadingLabel ?? words.loading}</span>
            {Array.from({ length: loadingRows }, (_, i) => (
              // Placeholder rows have no identity but their place.
              <div key={i} className="flex items-center gap-4">
                <Skeleton
                  shape="circle"
                  className={cn(
                    'shrink-0',
                    small ? 'size-(--shifa-size-avatar-sm)' : 'size-(--shifa-size-avatar-md)',
                  )}
                />
                <SkeletonText lines={2} />
              </div>
            ))}
          </div>
        )}
        {emptyShown && (
          <EmptyState
            title={empty.title}
            {...(empty.description === undefined ? {} : { description: empty.description })}
            icon={empty.icon ?? 'magnifying-glass'}
          />
        )}
        {showRows && (
          <div
            ref={body}
            onKeyDown={move}
            {...(layout === 'tiles' ? { style: TILES } : {})}
            className={cn('min-w-0', layout === 'tiles' ? 'grid gap-3' : 'flex flex-col')}
          >
            {items.map((item) => (
              <RecordRow key={item.id} item={item} ctx={ctx} />
            ))}
          </div>
        )}
      </div>
      {/* After the list, not in it: a screen reader hears it as the list's note, not a row. */}
      {footer !== undefined && !loading && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border-default bg-bg-surface-raised px-4 py-3 text-caption leading-body text-text-muted">
          {footer}
        </div>
      )}
    </div>
  );
}
