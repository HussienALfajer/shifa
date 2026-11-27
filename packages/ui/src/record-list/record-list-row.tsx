// One row of RecordList (A-03-01, sheet A03SheetRecordList): the avatar, a type icon or the lock;
// the title with its matched words heavier; the second line; the table's cells; the end (chevron,
// button, tools, badge). A row is a real link when it has an `href` and no controls.
import { Fragment, type MouseEvent, type ReactNode } from 'react';
import { Avatar } from '../avatar/avatar.tsx';
import { Badge } from '../badge/badge.tsx';
import { Button } from '../button/button.tsx';
import { IconButton } from '../icon-button/icon-button.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import type { RecordListCell, RecordListColumn, RecordListItem } from './types.ts';

export interface RowContext {
  table: boolean;
  tiles: boolean;
  small: boolean;
  chevron: boolean;
  columns: readonly RecordListColumn[];
  lockedLabel: string;
  /** The link holding the list's Tab stop. */
  tabStop: string | null;
  onLinkFocus: (id: string) => void;
  onOpen: ((id: string, event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
}

/** A title, a column or the main part takes a share of the row's width (flex grow). */
export const share = (weight: number) => ({ flex: `${String(weight)} 1 0` }) as const;
/** The title's share in the table layout, against 1 per column by default. */
export const TITLE_SHARE = 2.6;

const KIND: Record<NonNullable<RecordListCell['kind']>, string> = {
  text: '',
  number: 'font-semibold tabular-nums',
  latin: 'font-mono',
  muted: 'text-text-muted',
};

function Value({ cell }: { cell: RecordListCell }) {
  if (cell.kind === 'latin') {
    return (
      <bdi dir="ltr" data-kind="latin" className="font-mono">
        {cell.text}
      </bdi>
    );
  }
  return <span className={KIND[cell.kind ?? 'text']}>{cell.text}</span>;
}

function Title({ item, dim }: { item: RecordListItem; dim: boolean }) {
  const words = item.title.split(' ');
  const marks = item.matches ?? [];
  return (
    <span
      data-slot="record-title"
      className={cn(
        'leading-heading',
        dim ? 'text-text-muted' : 'text-text-default',
        marks.length === 0 && 'font-medium',
      )}
    >
      {words.map((word, i) => (
        // Words of one title never reorder: the index is their identity.
        <Fragment key={i}>
          {i > 0 && ' '}
          {marks.includes(i) ? <b className="font-bold">{word}</b> : <span>{word}</span>}
        </Fragment>
      ))}
    </span>
  );
}

/** The second line: badges and short texts, `·` between two texts; in two lines, the cells too. */
function Details({
  item,
  ctx,
  cellsHere,
}: {
  item: RecordListItem;
  ctx: RowContext;
  cellsHere: 'all' | 'narrow' | 'none';
}) {
  interface Piece {
    key: string;
    node: ReactNode;
    text: boolean;
    narrowOnly: boolean;
  }
  const pieces: Piece[] = (item.details ?? []).map((d, i) =>
    'badge' in d
      ? {
          key: `d${String(i)}`,
          text: false,
          narrowOnly: false,
          node: (
            <Badge
              {...(d.tone === undefined ? {} : { tone: d.tone })}
              {...(d.icon === undefined ? {} : { icon: d.icon })}
            >
              {d.badge}
            </Badge>
          ),
        }
      : {
          key: `d${String(i)}`,
          text: true,
          narrowOnly: false,
          node:
            d.kind === 'latin' ? (
              <bdi dir="ltr" className="font-mono">
                {d.text}
              </bdi>
            ) : (
              <span>{d.text}</span>
            ),
        },
  );
  if (cellsHere !== 'none') {
    for (const [i, cell] of (item.cells ?? []).entries()) {
      const header = ctx.columns[i]?.header;
      pieces.push({
        key: `c${String(i)}`,
        text: true,
        narrowOnly: cellsHere === 'narrow',
        node: (
          <span>
            {header !== undefined && <span className="sr-only">{`${header}: `}</span>}
            <Value cell={cell} />
          </span>
        ),
      });
    }
  }
  if (pieces.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption leading-body text-text-muted">
      {pieces.map((piece, i) => {
        const hide = piece.narrowOnly && '@record-table:hidden';
        const sep = i > 0 && piece.text && pieces[i - 1]?.text;
        return (
          <Fragment key={piece.key}>
            {sep && (
              <span aria-hidden="true" className={cn('text-border-strong', hide)}>
                ·
              </span>
            )}
            <span className={cn('inline-flex', hide)}>{piece.node}</span>
          </Fragment>
        );
      })}
    </span>
  );
}

function Lead({ item, ctx }: { item: RecordListItem; ctx: RowContext }) {
  const box = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full border',
    ctx.small ? 'size-(--shifa-size-avatar-sm)' : 'size-(--shifa-size-avatar-md)',
  );
  if (item.locked) {
    return (
      <span
        className={cn(
          box,
          'border-dashed border-border-strong bg-bg-surface-raised text-text-muted',
        )}
      >
        <Icon name="eye-slash" label={item.lockedLabel ?? ctx.lockedLabel} />
      </span>
    );
  }
  if (item.icon !== undefined) {
    return (
      <span className={cn(box, 'border-border-default bg-selection-subtle text-text-default')}>
        <Icon name={item.icon} />
      </span>
    );
  }
  return (
    // Dim: grey, not faded. The sheet's 60 % opacity left the initials under 4.5 : 1 (axe).
    <span aria-hidden="true" className={cn('inline-flex shrink-0', item.dim && 'grayscale')}>
      <Avatar
        name={item.avatarName ?? item.title}
        {...(item.avatarSrc === undefined ? {} : { src: item.avatarSrc })}
        size={ctx.small ? 'sm' : 'md'}
      />
    </span>
  );
}

function Trail({ item, link, ctx }: { item: RecordListItem; link: boolean; ctx: RowContext }) {
  if (link) {
    return ctx.chevron ? (
      <span className="inline-flex shrink-0 text-text-muted">
        <Icon name="caret-forward" />
      </span>
    ) : null;
  }
  const tools = item.tools ?? [];
  if (tools.length === 0 && item.action === undefined && item.badge === undefined) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {tools.map((tool) => (
        <IconButton
          key={tool.label}
          icon={tool.icon}
          label={tool.label}
          variant="ghost"
          size="sm"
          tooltip
          disabled={tool.disabled === true}
          onClick={() => {
            tool.onClick();
          }}
        />
      ))}
      {item.action !== undefined && (
        <Button
          size="sm"
          variant={item.action.variant ?? 'secondary'}
          onClick={() => {
            item.action?.onClick();
          }}
        >
          {item.action.label}
        </Button>
      )}
      {item.action === undefined && item.badge !== undefined && (
        <Badge
          {...(item.badge.tone === undefined ? {} : { tone: item.badge.tone })}
          {...(item.badge.icon === undefined ? {} : { icon: item.badge.icon })}
        >
          {item.badge.label}
        </Badge>
      )}
    </span>
  );
}

/** Whether the row is a link: an `href`, not locked, and no controls of its own. */
export const isLink = (item: RecordListItem) =>
  item.href !== undefined &&
  !item.locked &&
  item.action === undefined &&
  (item.tools ?? []).length === 0;

export function RecordRow({ item, ctx }: { item: RecordListItem; ctx: RowContext }) {
  const link = isLink(item);
  const dim = item.dim === true;
  const box = cn(
    'flex min-h-(--shifa-size-row) min-w-0 items-center text-text-default no-underline',
    ctx.small ? 'gap-3 px-3 py-2' : 'gap-4 px-4 py-3',
    'in-data-[density=compact]:py-1',
  );
  const content = (
    <>
      <Lead item={item} ctx={ctx} />
      <span
        style={share(ctx.table ? TITLE_SHARE : 1)}
        className={cn('flex min-w-0 flex-col gap-0.5', ctx.small ? 'text-data' : 'text-body')}
      >
        <Title item={item} dim={dim} />
        <Details item={item} ctx={ctx} cellsHere={ctx.table ? 'narrow' : 'all'} />
      </span>
      {ctx.table &&
        (item.cells ?? []).map((cell, i) => {
          const column = ctx.columns[i];
          return (
            <span
              // Cells follow the columns, which never reorder: the index is their identity.
              key={i}
              style={share(column?.weight ?? 1)}
              className={cn(
                'hidden min-w-0 truncate text-data leading-body @record-table:block',
                (dim || cell.kind === 'muted') && 'text-text-muted',
              )}
            >
              {cell.icon !== undefined && (
                <Icon name={cell.icon} className="me-1 align-middle text-text-muted" />
              )}
              {column !== undefined && <span className="sr-only">{`${column.header}: `}</span>}
              <Value cell={cell} />
            </span>
          );
        })}
      <Trail item={item} link={link} ctx={ctx} />
    </>
  );
  const current = item.current === true;
  return (
    <div
      role="listitem"
      data-slot="record-row"
      data-id={item.id}
      className={cn(
        'relative min-w-0',
        ctx.tiles
          ? 'overflow-hidden rounded-(--shifa-card-radius) border border-border-default bg-bg-surface'
          : 'not-first:border-t not-first:border-border-default',
        current && 'bg-selection-default',
      )}
    >
      {link ? (
        <a
          href={item.href}
          data-record-nav=""
          tabIndex={ctx.tabStop === item.id ? 0 : -1}
          {...(current ? { 'aria-current': 'true' as const } : {})}
          onFocus={() => {
            ctx.onLinkFocus(item.id);
          }}
          onClick={(event) => {
            ctx.onOpen?.(item.id, event);
          }}
          className={cn(
            box,
            'cursor-pointer outline-none',
            current ? 'hover:bg-selection-strong' : 'hover:bg-selection-subtle',
            'focus-visible:shadow-focus focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus',
          )}
        >
          {content}
        </a>
      ) : (
        <div {...(current ? { 'aria-current': 'true' as const } : {})} className={box}>
          {content}
        </div>
      )}
    </div>
  );
}
