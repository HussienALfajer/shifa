// Pieces the clinic page tabs share (slice A-02-08; board `A02Clinic`): the card, a list row of a
// fixed grid (the drawing's `.rowItem`), the failed and loading states, and the note a save leaves
// above the cards.
import type { CommonKey } from '@shifa/i18n';
import { Button, Callout, Card, cn, EmptyState, SkeletonGroup, SkeletonText } from '@shifa/ui';
import type { CSSProperties, ReactNode } from 'react';
import { useText } from '../text.ts';

/** The tabs' column of cards: twice the A-01-10 card width, as the drawing's `.wide`. */
export function TabStack({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: 'calc(var(--shifa-width-140) * 2)' }}>
      {children}
    </div>
  );
}

/** A note above the cards after a save or a refusal. */
export interface TabNote {
  tone: 'success' | 'danger' | 'warning' | 'info';
  icon?: 'warning' | 'wifi-slash';
  title: string;
  text?: string;
}

export function NoteCallout({ note }: { note: TabNote | null }) {
  if (note === null) return null;
  return (
    <Callout
      tone={note.tone}
      {...(note.icon === undefined ? {} : { icon: note.icon })}
      title={note.title}
    >
      {note.text}
    </Callout>
  );
}

/** The tab's surface: the Card with the drawing's heading and its muted line. */
export function TabCard({
  title,
  text,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  text?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Card className={cn('gap-4 p-(--shifa-card-padding)', className)}>
      {(title !== undefined || actions !== undefined) && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {title !== undefined && (
              <h2 className="m-0 text-heading-sm leading-heading font-semibold">{title}</h2>
            )}
            {text !== undefined && (
              <p className="m-0 text-data leading-body text-text-muted">{text}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </Card>
  );
}

/** One row of a list drawn as a grid; `head` is the header row (muted, no top line). */
export function GridRow({
  columns,
  head = false,
  rowKey,
  children,
}: {
  columns: string;
  head?: boolean;
  /** The row's key, for tests and journeys (`data-row`). */
  rowKey?: string;
  children: ReactNode;
}) {
  const style: CSSProperties = { gridTemplateColumns: columns };
  return (
    <div
      {...(head ? { 'aria-hidden': true } : {})}
      {...(rowKey === undefined ? {} : { 'data-row': rowKey })}
      style={style}
      className={cn(
        'grid items-center gap-4 py-3 text-start',
        head
          ? 'text-caption leading-heading font-medium text-text-muted'
          : 'border-t border-border-default text-data leading-body',
      )}
    >
      {children}
    </div>
  );
}

/** A tab's read that failed: «تعذّر التحميل» with «إعادة المحاولة». */
export function TabFailed({ retry }: { retry: () => unknown }) {
  const text = useText();
  return (
    <TabCard className="max-w-(--shifa-width-140)">
      <EmptyState
        icon="wifi-slash"
        title={text('loadFailedTitle')}
        description={text('loadFailedText')}
        actions={
          <Button variant="secondary" onClick={() => void retry()}>
            {text('retry')}
          </Button>
        }
      />
    </TabCard>
  );
}

export function TabLoading({ label }: { label: CommonKey }) {
  const text = useText();
  return (
    <TabCard>
      <SkeletonGroup label={text(label)}>
        <SkeletonText lines={6} />
      </SkeletonGroup>
    </TabCard>
  );
}

/** «KEY» under a key's words: the catalogue key, Latin, muted. */
export function KeyCell({ word, code }: { word: string; code: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span>{word}</span>
      <span dir="ltr" className="self-start text-caption leading-heading text-text-muted">
        {code}
      </span>
    </div>
  );
}
