// RecordHeader (A-03-01), as the owner approved the sheet on 2026-11-27 ("Shifa Screens · Clinic
// web", page "Proposals", A03SheetRecordHeader): who a record is, at the top of its page. A region
// named for the record; the avatar, the title (h1 on a page, h2 in a panel), the record number in a
// gold tag (gold ring and fill, the text in the text colour, read «ملف 1043»), badges and one with
// a Tooltip (an estimated age: the «~» stays visible, the tooltip only explains), facts under a
// rule, a meta line, then the actions (buttons and one Menu, which is a bottom sheet on touch) or
// «للقراءة فقط». Muted for an archived or merged record: the raised surface and no write actions.
// Compact inside a panel: h2, no facts, the number larger. On a phone the actions go under the
// title and the facts take one column.
import type { ReactNode } from 'react';
import { Avatar } from '../avatar/avatar.tsx';
import { Badge, type BadgeTone } from '../badge/badge.tsx';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { useDirection } from '../providers/direction-provider.tsx';
import { Skeleton, SkeletonText } from '../skeleton/skeleton.tsx';
import { Tooltip } from '../tooltip/tooltip.tsx';

export interface RecordHeaderBadge {
  label: string;
  tone?: BadgeTone | undefined;
  icon?: IconName | undefined;
  /** Explains the badge in a Tooltip; the badge then takes focus. Never the only copy. */
  tip?: string | undefined;
}

export interface RecordHeaderFact {
  label: ReactNode;
  value: ReactNode;
  /** `latin`: isolated left to right in the mono face (phones, codes); `number`: tabular. */
  kind?: 'text' | 'number' | 'latin' | undefined;
}

export interface RecordHeaderProps {
  /** The region's name («هوية المريض»); the title by default. */
  'aria-label'?: string | undefined;
  title: string;
  /** The avatar's name when it differs from the title (a title with «د.»). */
  avatarName?: string | undefined;
  avatarSrc?: string | undefined;
  /** The word before the number («ملف»). */
  idLabel?: string | undefined;
  /** The record number in the gold tag; none when left out. */
  idValue?: string | undefined;
  badges?: readonly RecordHeaderBadge[] | undefined;
  facts?: readonly RecordHeaderFact[] | undefined;
  /** A muted line under the facts («آخر تعديل 20/11/2026 بيد …»). */
  meta?: ReactNode;
  /** Buttons and at most one Menu, at the end; hidden when `muted`. */
  actions?: ReactNode;
  /** Shown in place of the actions («للقراءة فقط»). */
  readOnlyNote?: ReactNode;
  /** Archived or merged: the raised surface, no actions. */
  muted?: boolean | undefined;
  /** Inside a panel (the saved file): h2, no facts, the number larger. */
  compact?: boolean | undefined;
  loading?: boolean | undefined;
  loadingLabel?: string | undefined;
  className?: string | undefined;
}

const LOADING = { rtl: 'جارٍ فتح الملف', ltr: 'Opening the record' } as const;

export function RecordHeader({
  title,
  avatarName,
  avatarSrc,
  idLabel,
  idValue,
  badges = [],
  facts = [],
  meta,
  actions,
  readOnlyNote,
  muted = false,
  compact = false,
  loading = false,
  loadingLabel,
  className,
  ...props
}: RecordHeaderProps) {
  const dir = useDirection();
  const Heading = compact ? 'h2' : 'h1';
  const showFacts = !compact && facts.length > 0;
  return (
    <section
      aria-label={props['aria-label'] ?? title}
      aria-busy={loading || undefined}
      data-slot="record-header"
      className={cn(
        'flex flex-wrap items-start rounded-(--shifa-card-radius) border border-(--shifa-card-border)',
        'font-ui text-text-default',
        compact ? 'gap-4 p-4' : 'gap-5 p-(--shifa-card-padding)',
        muted ? 'bg-bg-surface-raised' : 'bg-(--shifa-card-bg) shadow-card',
        className,
      )}
    >
      {loading ? (
        <div className="flex flex-1 items-start gap-4">
          <span className="sr-only">{loadingLabel ?? LOADING[dir]}</span>
          <Skeleton shape="circle" className="size-(--shifa-size-avatar-lg) shrink-0" />
          <SkeletonText lines={3} />
        </div>
      ) : (
        <>
          <Avatar
            name={avatarName ?? title}
            {...(avatarSrc === undefined ? {} : { src: avatarSrc })}
            size={compact ? 'md' : 'lg'}
          />
          <div className="flex min-w-0 flex-1 basis-(--shifa-width-80) flex-col gap-2">
            <Heading
              className={cn(
                'm-0 font-semibold leading-heading',
                compact ? 'text-heading-sm' : 'text-heading-md',
              )}
            >
              {title}
            </Heading>
            {(idValue !== undefined || badges.length > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                {idValue !== undefined && (
                  <span
                    data-slot="record-id"
                    className={cn(
                      'inline-flex items-baseline gap-1 rounded-full border border-brand-accent bg-brand-accent-soft text-text-default',
                      compact
                        ? 'px-4 py-1 text-body leading-body'
                        : 'min-h-7 px-3 py-0.5 text-data leading-body',
                    )}
                  >
                    {/* A real space, so it is read «ملف 1043». */}
                    {idLabel !== undefined && <span>{idLabel} </span>}
                    <b
                      dir="ltr"
                      className={cn(
                        // `dir` isolates it from the Arabic around it (HTML's own rule).
                        'font-bold tabular-nums',
                        compact && 'text-heading-sm leading-heading',
                      )}
                    >
                      {idValue}
                    </b>
                  </span>
                )}
                {badges.map((badge) => (
                  <HeaderBadge key={badge.label} badge={badge} />
                ))}
              </div>
            )}
            {showFacts && (
              <dl
                style={FACTS}
                className="m-0 mt-1 grid gap-x-4 gap-y-3 border-t border-border-default pt-3"
              >
                {facts.map((fact, i) => (
                  // Facts never reorder while shown: the index is their identity.
                  <div key={i} className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-caption leading-body text-text-muted">{fact.label}</dt>
                    <dd
                      {...(fact.kind === 'latin' ? { dir: 'ltr' } : {})}
                      className={cn(
                        'm-0 text-data font-medium leading-body',
                        fact.kind === 'latin' && 'self-start font-mono',
                        fact.kind === 'number' && 'tabular-nums',
                      )}
                    >
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {meta !== undefined && meta !== '' && (
              <p className="m-0 text-caption leading-body text-text-muted">{meta}</p>
            )}
          </div>
          {((!muted && actions !== undefined) || readOnlyNote !== undefined) && (
            <div className="flex flex-wrap items-center gap-(--shifa-gap-inline)">
              {!muted && actions}
              {readOnlyNote !== undefined && (
                <span className="inline-flex items-center gap-1 text-caption leading-body text-text-muted">
                  <Icon name="eye" />
                  {readOnlyNote}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Facts in as many 150 px columns as fit; one column on a phone. */
const FACTS = {
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(var(--shifa-width-37-5), 100%), 1fr))',
} as const;

function HeaderBadge({ badge }: { badge: RecordHeaderBadge }) {
  const look = (
    <Badge
      {...(badge.tone === undefined ? {} : { tone: badge.tone })}
      {...(badge.icon === undefined ? {} : { icon: badge.icon })}
    >
      {badge.label}
    </Badge>
  );
  if (badge.tip === undefined) return look;
  return (
    <Tooltip content={badge.tip}>
      <button
        type="button"
        data-slot="record-badge-tip"
        className="inline-flex cursor-help rounded-full border-0 bg-transparent p-0 outline-none focus-visible:shadow-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      >
        {look}
      </button>
    </Tooltip>
  );
}
