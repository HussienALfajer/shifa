// Usage chart (A-02-01), as the owner approved the sheet on 2026-11-27 ("Shifa Screens · Admin
// web", page "Proposals", A02SheetUsageChart): daily counts as bars in the brand colour, today in
// gold, a day without activity a thin line in the strong border colour. A y-axis in quarters with
// grid lines; the daily average as a dashed gold line named at the oldest days. Time runs from left
// to right in both directions, like the digits. Each bar is the system's Tooltip trigger (the
// figure, then the day); one Tab stop, the arrows move between days by their place; a screen
// reader hears a summary. The figures above the chart and the series switch belong to the screen.
// No charting library.
import { type KeyboardEvent, useId, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../empty-state/empty-state.tsx';
import { cn } from '../lib/cn.ts';
import { NUMBER_LOCALE } from '../number-input/number-input.tsx';
import { useDirection } from '../providers/direction-provider.tsx';
import { Skeleton } from '../skeleton/skeleton.tsx';
import { Tooltip } from '../tooltip/tooltip.tsx';

export interface UsageChartDay {
  /** The day, `YYYY-MM-DD` (a Damascus day, as the API sends it). */
  date: string;
  count: number;
}

/** The chart's words; Arabic in RTL and English in LTR unless given. */
export interface UsageChartLabels {
  /** Before the average's figure: «المتوسط». */
  average: string;
  /** Under the last bar: «اليوم». */
  today: string;
  pastDay: string;
  todaySoFar: string;
  dailyAverage: string;
  emptyTitle: string;
  emptyDescription: string;
  loading: string;
  /** The screen reader's summary from the figures. */
  /** `day` is null when no day had any count. */
  summary: (s: { total: string; average: string; highest: string; day: string | null }) => string;
}

const LABELS: Record<'rtl' | 'ltr', UsageChartLabels> = {
  rtl: {
    average: 'المتوسط',
    today: 'اليوم',
    pastDay: 'يوم مضى',
    todaySoFar: 'اليوم حتى الآن',
    dailyAverage: 'المتوسط اليومي',
    emptyTitle: 'لا بيانات بعد',
    emptyDescription: 'تظهر أولى الأرقام غدًا.',
    loading: 'جارٍ التحميل',
    summary: (s) =>
      s.day === null
        ? 'لا نشاط في هذه الأيام.'
        : `المجموع ${s.total}، المتوسط اليومي ${s.average}، أعلى يوم ${s.highest} في ${s.day}.`,
  },
  ltr: {
    average: 'Average',
    today: 'Today',
    pastDay: 'Past day',
    todaySoFar: 'Today so far',
    dailyAverage: 'Daily average',
    emptyTitle: 'No data yet',
    emptyDescription: 'The first figures show tomorrow.',
    loading: 'Loading',
    summary: (s) =>
      s.day === null
        ? 'No activity on these days.'
        : `Total ${s.total}, daily average ${s.average}, highest day ${s.highest} on ${s.day}.`,
  },
};

export interface UsageChartProps {
  /** What the chart shows: «آخر 30 يومًا». */
  'aria-label': string;
  /** Oldest first; the last is today (drawn in gold). None: the empty state. */
  days: readonly UsageChartDay[];
  /** A count with its unit, for each bar's tooltip and name: `(n) => \`${n} تسجيل دخول\``. */
  unit: (count: number) => string;
  /** The last day is today, still counting (default true). */
  lastIsToday?: boolean;
  loading?: boolean;
  labels?: Partial<UsageChartLabels>;
  className?: string;
}

/** «28/10» from «2026-10-28»: Western digits in both directions. */
const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** The axis top: four equal whole steps at or above the highest count. */
export function axisMax(highest: number): number {
  return Math.max(1, Math.ceil(highest / 4)) * 4;
}

const QUARTERS = [0, 25, 50, 75, 100] as const;
const PLOT_HEIGHT = { height: 'calc(var(--shifa-width-100) / 2)' };
const CAPTION = 'text-caption leading-heading text-text-muted tabular-nums';

export function UsageChart({
  days,
  unit,
  lastIsToday = true,
  loading = false,
  className,
  ...props
}: UsageChartProps) {
  const dir = useDirection();
  const labels = { ...LABELS[dir], ...props.labels };
  const number = useMemo(
    () => new Intl.NumberFormat(NUMBER_LOCALE[dir], { maximumFractionDigits: 1 }),
    [dir],
  );
  const summaryId = useId();
  // The day with the Tab stop; null until one is focused: today (the last day), also once data
  // arrives after loading.
  const [active, setActive] = useState<number | null>(null);
  const focusIndex = Math.min(Math.max(active ?? days.length - 1, 0), days.length - 1);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const total = days.reduce((sum, d) => sum + d.count, 0);
  const average = days.length > 0 ? total / days.length : 0;
  const highestIndex = days.reduce(
    (best, d, i) => (d.count > (days[best]?.count ?? 0) ? i : best),
    0,
  );
  const top = axisMax(days[highestIndex]?.count ?? 0);
  const pct = (n: number) => `${String((n / top) * 100)}%`;

  const move = (event: KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowLeft: focusIndex - 1,
      ArrowRight: focusIndex + 1,
      Home: 0,
      End: days.length - 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const index = Math.min(Math.max(next, 0), days.length - 1);
    setActive(index);
    buttons.current[index]?.focus();
  };

  const busy = loading || undefined;
  const hasData = !loading && days.length > 0;
  return (
    <div
      role="group"
      aria-label={props['aria-label']}
      aria-busy={busy}
      {...(hasData ? { 'aria-describedby': summaryId } : {})}
      data-slot="usage-chart"
      className={cn('flex min-w-0 flex-col gap-2 font-ui text-text-default', className)}
    >
      {loading && (
        <div style={PLOT_HEIGHT} className="flex">
          <Skeleton className="size-full" />
        </div>
      )}
      {loading && <span className="sr-only">{labels.loading}</span>}
      {!loading && days.length === 0 && (
        <EmptyState art="jasmine" title={labels.emptyTitle} description={labels.emptyDescription} />
      )}
      {hasData && (
        <>
          <p id={summaryId} className="sr-only">
            {labels.summary({
              total: number.format(total),
              average: number.format(average),
              highest: number.format(days[highestIndex]?.count ?? 0),
              day:
                (days[highestIndex]?.count ?? 0) > 0
                  ? dayMonth(days[highestIndex]?.date ?? '')
                  : null,
            })}
          </p>
          <div dir="ltr" className="mt-4 flex gap-2">
            <div
              data-slot="usage-y-axis"
              aria-hidden="true"
              className="relative w-8 shrink-0"
              style={PLOT_HEIGHT}
            >
              {QUARTERS.map((q) => (
                <span
                  key={q}
                  className={cn('absolute end-0 translate-y-1/2', CAPTION)}
                  style={{ bottom: `${String(q)}%` }}
                >
                  {number.format((top * q) / 100)}
                </span>
              ))}
            </div>
            <div
              data-slot="usage-plot"
              className="relative flex min-w-0 flex-1 items-end gap-1 border-b border-border-strong"
              style={PLOT_HEIGHT}
              onKeyDown={move}
            >
              {QUARTERS.slice(1).map((q) => (
                <span
                  key={q}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 border-t border-border-default"
                  style={{ bottom: `${String(q)}%` }}
                />
              ))}
              <div
                data-slot="usage-average"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 z-1 translate-y-1/2 border-t-2 border-dashed border-brand-accent"
                style={{ bottom: pct(average) }}
              >
                <span
                  className={cn('absolute start-0 -translate-y-full bg-bg-surface px-1', CAPTION)}
                >
                  {`${labels.average} ${number.format(average)}`}
                </span>
              </div>
              {days.map((day, i) => {
                const text = `${unit(day.count)} · ${dayMonth(day.date)}`;
                const today = lastIsToday && i === days.length - 1;
                return (
                  <div
                    key={day.date}
                    data-slot="usage-bar"
                    className="relative h-full min-w-0 flex-1"
                  >
                    <Tooltip content={text} type="label">
                      <button
                        ref={(node) => {
                          buttons.current[i] = node;
                        }}
                        type="button"
                        aria-label={text}
                        tabIndex={i === focusIndex ? 0 : -1}
                        onFocus={() => {
                          setActive(i);
                        }}
                        className={cn(
                          'group/bar flex size-full cursor-default flex-col justify-end border-0 bg-transparent p-0',
                          'rounded-mark outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
                        )}
                      >
                        <span
                          data-slot="usage-fill"
                          className={cn(
                            'block min-h-0.5 w-full rounded-ss-mark rounded-se-mark',
                            'transition-colors duration-(--shifa-motion-duration-fast) motion-reduce:transition-none',
                            today
                              ? 'bg-brand-accent'
                              : day.count === 0
                                ? 'bg-border-strong'
                                : 'bg-brand-primary group-hover/bar:bg-brand-primary-hover',
                          )}
                          style={{ height: pct(day.count) }}
                        />
                      </button>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </div>
          <Axis days={days} today={lastIsToday ? labels.today : null} />
          <div className={cn('flex flex-wrap gap-4', CAPTION)}>
            <Key className="bg-brand-primary">{labels.pastDay}</Key>
            {lastIsToday && <Key className="bg-brand-accent">{labels.todaySoFar}</Key>}
            <Key className="h-0 rounded-none border-t-2 border-dashed border-brand-accent">
              {labels.dailyAverage}
            </Key>
          </div>
        </>
      )}
    </div>
  );
}

/** Every seventh day from the oldest, and the last (today), under its bar. */
function Axis({ days, today }: { days: readonly UsageChartDay[]; today: string | null }) {
  const last = days.length - 1;
  const marks = days
    .map((d, i) => ({ i, text: i === last && today !== null ? today : dayMonth(d.date) }))
    .filter(({ i }) => i === last || (i % 7 === 0 && last - i >= 4));
  return (
    <div dir="ltr" aria-hidden="true" className="flex gap-2">
      <span className="w-8 shrink-0" />
      <div className={cn('relative h-5 min-w-0 flex-1', CAPTION)}>
        {marks.map(({ i, text }) => (
          <span
            key={i}
            className={cn(
              'absolute top-0 whitespace-nowrap',
              i === last ? '-translate-x-full' : i === 0 ? 'translate-x-0' : '-translate-x-1/2',
            )}
            style={{
              insetInlineStart: i === last ? '100%' : `${String(((i + 0.5) / days.length) * 100)}%`,
            }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

function Key({ className, children }: { className: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden="true" className={cn('inline-block size-3 rounded-mark', className)} />
      {children}
    </span>
  );
}
