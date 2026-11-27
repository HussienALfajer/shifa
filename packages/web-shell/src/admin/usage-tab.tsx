// «الاستخدام» on the clinic page (slice A-02-08; board `A02Clinic`, states `use` … `useEmpty`; A-02
// criteria 17, 19): the last activity, today's four figures (each with yesterday's or its whole),
// and the last 30 Damascus days as the UsageChart of the chosen series (sign-ins or members
// signed in), with the total and its change against the 30 days before, the daily average, the
// highest day and the days without activity, all computed here from `days`.
import { Badge, EmptyState, SegmentedControl, UsageChart, type UsageChartDay } from '@shifa/ui';
import { type ReactNode, useState } from 'react';
import { useText } from '../text.ts';
import { activityText, type ClinicUsage, useUsage } from './clinic-data.ts';
import { TabCard, TabFailed, TabLoading, TabStack } from './tab-parts.tsx';

type Series = 'signIns' | 'membersSignedIn';
type Text = ReturnType<typeof useText>;

const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** The figures above the chart, from the 30 days of one series. */
export function figures(usage: ClinicUsage, series: Series) {
  const counts = usage.days.map((d) => d[series]);
  const total = counts.reduce((a, b) => a + b, 0);
  const average = counts.length === 0 ? 0 : Math.round((total / counts.length) * 10) / 10;
  const peak = counts.reduce((best, n, i) => (n > (counts[best] ?? 0) ? i : best), 0);
  const previous = usage.previousTotals[series];
  return {
    total,
    average,
    peak: counts[peak] ?? 0,
    peakDay: total === 0 ? null : (usage.days[peak]?.date ?? null),
    idle: counts.filter((n) => n === 0).length,
    change: previous === 0 ? null : Math.round(((total - previous) / previous) * 100),
  };
}

function Stat({
  id,
  label,
  value,
  note,
}: {
  id: string;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div
      data-stat={id}
      className="flex flex-col gap-1 rounded-surface border border-border-default bg-bg-surface p-4"
    >
      <span className="text-data leading-body text-text-muted">{label}</span>
      <span className="text-heading-md leading-heading font-semibold tabular-nums">
        {String(value)}
      </span>
      <span className="text-caption leading-heading text-text-muted">{note}</span>
    </div>
  );
}

function Kpi({ label, value, badge }: { label: string; value: string; badge?: ReactNode }) {
  return (
    <div data-kpi className="flex flex-col gap-1 py-2">
      <span className="text-caption leading-heading text-text-muted">{label}</span>
      <span className="text-heading-sm leading-heading font-semibold tabular-nums">{value}</span>
      {badge !== undefined && <span className="flex">{badge}</span>}
    </div>
  );
}

function changeBadge(text: Text, change: number | null) {
  if (change === null) return undefined;
  const sign = change > 0 ? '+' : '';
  return (
    <Badge tone={change > 0 ? 'success' : change < 0 ? 'warning' : 'neutral'}>
      {text('usageChange', { change: `${sign}${String(change)}` })}
    </Badge>
  );
}

function Loaded({ usage }: { usage: ClinicUsage }) {
  const text = useText();
  const [series, setSeries] = useState<Series>('signIns');
  const f = figures(usage, series);
  const yesterday = usage.days.at(-2);
  const days: UsageChartDay[] = usage.days.map((d) => ({ date: d.date, count: d[series] }));
  const unit = (count: number) =>
    text(series === 'signIns' ? 'usageUnitSignIns' : 'usageUnitMembers', { count });
  return (
    <TabStack>
      <p className="m-0 text-data leading-body text-text-muted">
        {text('usageLast', { when: activityText(text, usage.lastActivityAt) })}
      </p>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          id="signIns"
          label={text('usageSignInsToday')}
          value={usage.todayCounts.signIns}
          note={text('usageYesterday', { count: yesterday?.signIns ?? 0 })}
        />
        <Stat
          id="membersSignedIn"
          label={text('usageMembersToday')}
          value={usage.todayCounts.membersSignedIn}
          note={text('usageYesterday', { count: yesterday?.membersSignedIn ?? 0 })}
        />
        <Stat
          id="activeMembers"
          label={text('usageActiveMembers')}
          value={usage.todayCounts.activeMembers}
          note={text('usageOfMembers', { count: usage.members })}
        />
        <Stat
          id="activeBranches"
          label={text('usageActiveBranches')}
          value={usage.todayCounts.activeBranches}
          note={
            usage.todayCounts.activeBranches === usage.branches
              ? text('usageAllBranches')
              : text('usageOfBranches', { count: usage.branches })
          }
        />
      </div>
      <TabCard
        title={text('usage30')}
        text={text(series === 'signIns' ? 'usageSubSignIns' : 'usageSubMembers')}
        actions={
          <SegmentedControl
            aria-label={text('usageSeries')}
            value={series}
            onValueChange={(v) => {
              setSeries(v as Series);
            }}
            items={[
              { value: 'signIns', label: text('usageSeriesSignIns') },
              { value: 'membersSignedIn', label: text('usageSeriesMembers') },
            ]}
          />
        }
      >
        <div className="grid grid-cols-2 gap-4 border-y border-border-default py-2 xl:grid-cols-4">
          <Kpi
            label={text('usageTotal')}
            value={String(f.total)}
            badge={changeBadge(text, f.change)}
          />
          <Kpi label={text('usageAverage')} value={String(f.average)} />
          <Kpi
            label={
              f.peakDay === null
                ? text('usagePeakNone')
                : text('usagePeak', { day: dayMonth(f.peakDay) })
            }
            value={String(f.peak)}
          />
          <Kpi label={text('usageIdleDays')} value={String(f.idle)} />
        </div>
        <UsageChart aria-label={text('usage30')} days={days} unit={unit} />
      </TabCard>
    </TabStack>
  );
}

export function UsageTab({ clinicId }: { clinicId: string }) {
  const text = useText();
  const { data, isError, isPending, refetch } = useUsage(clinicId);
  if (isPending) return <TabLoading label="usageLoading" />;
  if (isError || !data) return <TabFailed retry={refetch} />;
  if (!data.hasData) {
    return (
      <TabStack>
        <TabCard>
          <EmptyState
            art="jasmine"
            title={text('usageEmptyTitle')}
            description={text('usageEmptyText')}
          />
        </TabCard>
      </TabStack>
    );
  }
  return <Loaded usage={data} />;
}
