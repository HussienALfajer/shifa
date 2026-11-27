// DescriptionList (A-03-01), as the owner approved the sheet on 2026-11-27 ("Shifa Screens · Clinic
// web", page "Proposals", A03SheetDescriptionList): labels and their values grouped by section, the
// clinic's fields on a patient's chart and later the details of any record. A real dl, dt, dd per
// section under its h3; an empty value shows «—» muted and is read «فارغ»; a value may carry one
// badge («حساس»), read after it; latin values (card numbers, codes) isolated left to right; one
// column, or as many 320 px columns as fit (`columns={2}`); loading. Nothing in it is pressed:
// editing is the record's form.
import type { CSSProperties, ReactNode } from 'react';
import { Badge, type BadgeTone } from '../badge/badge.tsx';
import type { IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { useDirection } from '../providers/direction-provider.tsx';
import { Skeleton, SkeletonText } from '../skeleton/skeleton.tsx';

export type DescriptionListValueKind = 'text' | 'number' | 'latin';

export interface DescriptionListRow {
  id: string;
  label: ReactNode;
  /** The value; `''`, `null` or `undefined` is empty («—», read «فارغ»). */
  value?: ReactNode;
  /** `latin`: isolated left to right in the mono face; `number`: tabular digits. */
  kind?: DescriptionListValueKind | undefined;
  /** One badge after the value («حساس»). */
  badge?: { label: string; tone?: BadgeTone | undefined; icon?: IconName | undefined } | undefined;
}

export interface DescriptionListSection {
  id: string;
  /** The section's heading (an h3); leave it out for one flat list. */
  title?: ReactNode;
  rows: readonly DescriptionListRow[];
}

export interface DescriptionListProps {
  /** Names the whole list («حقول العيادة»). */
  'aria-label': string;
  sections: readonly DescriptionListSection[];
  /** 1 (default), or 2: sections side by side, 320 px each at least, one column when narrow. */
  columns?: 1 | 2 | undefined;
  loading?: boolean | undefined;
  loadingLabel?: string | undefined;
  /** What a screen reader hears for an empty value (default «فارغ», English «Empty»). */
  emptyLabel?: string | undefined;
  className?: string | undefined;
}

const WORDS = {
  rtl: { empty: 'فارغ', loading: 'جارٍ التحميل' },
  ltr: { empty: 'Empty', loading: 'Loading' },
} as const;

/** Sections side by side, each at least 320 px and never wider than the box. */
const TWO: CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(var(--shifa-width-80), 100%), 1fr))',
};

/** A label and its value: the value a little wider, as on the sheet. */
const PAIR: CSSProperties = { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)' };

const isEmpty = (value: ReactNode) => value === '' || value === null || value === undefined;

export function DescriptionList({
  sections,
  columns = 1,
  loading = false,
  loadingLabel,
  emptyLabel,
  className,
  ...props
}: DescriptionListProps) {
  const words = WORDS[useDirection()];
  return (
    <div
      role="group"
      aria-label={props['aria-label']}
      aria-busy={loading || undefined}
      data-slot="description-list"
      {...(columns === 2 && !loading ? { style: TWO } : {})}
      className={cn(
        'min-w-0 font-ui text-text-default',
        columns === 2 && !loading ? 'grid items-start gap-x-6 gap-y-4' : 'flex flex-col gap-4',
        className,
      )}
    >
      {loading ? (
        <>
          <span className="sr-only">{loadingLabel ?? words.loading}</span>
          <Skeleton shape="line" className="w-1/3" />
          <SkeletonText lines={4} />
        </>
      ) : (
        sections.map((section) => (
          <section key={section.id} className="flex min-w-0 flex-col">
            {section.title !== undefined && (
              <h3 className="m-0 mb-1 text-caption font-semibold leading-body text-text-muted">
                {section.title}
              </h3>
            )}
            <dl className="m-0">
              {section.rows.map((row, i) => {
                const empty = isEmpty(row.value);
                return (
                  <div
                    key={row.id}
                    style={PAIR}
                    className={cn(
                      'grid items-baseline gap-x-4 border-t py-2',
                      'text-data leading-body in-data-[density=compact]:py-1',
                      i === 0 && section.title !== undefined
                        ? 'border-border-strong'
                        : 'border-border-default',
                    )}
                  >
                    <dt className="text-text-muted">{row.label}</dt>
                    <dd
                      className={cn(
                        'm-0 flex min-w-0 flex-wrap items-center gap-2 wrap-anywhere',
                        empty && 'text-text-muted',
                      )}
                    >
                      {empty ? (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">{emptyLabel ?? words.empty}</span>
                        </>
                      ) : row.kind === 'latin' ? (
                        <bdi dir="ltr" data-kind="latin" className="font-mono">
                          {row.value}
                        </bdi>
                      ) : (
                        <span className={cn(row.kind === 'number' && 'tabular-nums')}>
                          {row.value}
                        </span>
                      )}
                      {row.badge !== undefined && (
                        <Badge
                          {...(row.badge.tone === undefined ? {} : { tone: row.badge.tone })}
                          {...(row.badge.icon === undefined ? {} : { icon: row.badge.icon })}
                        >
                          {row.badge.label}
                        </Badge>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))
      )}
    </div>
  );
}
