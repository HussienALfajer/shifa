// «الاشتراك» on the clinic's settings (slice A-02-10; board `A02cSettings`, states `settings`,
// `subFull`, `subEnding`, `subLoading`; contract row "Settings · «الاشتراك»"; criteria 6, 25): GET
// /clinic/subscription for the owner — plan, status, end; each limit «22 من 35» with a meter (in
// the warning colour when full, with «وصلت العيادة إلى حد …»), «حتى 20» while a key is not counted;
// the features, «لا ميزات إضافية في خطتك بعد» when none; the end within 14 days of today
// (Damascus) → Callout «ينتهي اشتراكك خلال n أيام», counted on the client. 403 → no card.
import type { Schemas } from '@shifa/api-client-ts';
import type { CommonKey } from '@shifa/i18n';
import { Badge, Callout, Card, cn, SkeletonGroup, SkeletonText } from '@shifa/ui';
import { useQuery } from '@tanstack/react-query';
import { damascusToday, keyWord } from '../admin/clinic-data.ts';
import { calendarDate, STATUS_TONE, STATUS_WORD, TYPE_WORD } from '../admin/data.ts';
import { BRANCHES, isFull, type LimitUse, limitsOf, PRACTITIONERS } from '../capabilities.ts';
import { useShell } from '../providers.tsx';
import { useReadOnly } from '../support/support-banner.tsx';
import { useText } from '../text.ts';
import { LoadFailed } from './load-failed.tsx';

type Subscription = Schemas['Subscription'];

/** How many days before the end the warning shows (improvement 9). */
const ENDING_DAYS = 14;
const DAY = 86_400_000;

export const subscriptionKey = (tenantId: string) => ['clinic', tenantId, 'subscription'] as const;

function useSubscription(tenantId: string, enabled: boolean) {
  const { shell } = useShell();
  return useQuery({
    queryKey: subscriptionKey(tenantId),
    queryFn: async (): Promise<Subscription | null> => {
      const { data, response } = await shell.api.GET('/clinic/subscription');
      if (response.status === 403) return null;
      if (!data) throw new Error(`GET /clinic/subscription answered ${String(response.status)}`);
      const limits = limitsOf(data);
      return limits && Array.isArray(data.features) ? { ...data, limits } : null;
    },
    enabled,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** Whole days from today (Damascus) to a `YYYY-MM-DD` date. */
export function daysUntil(date: string, now = Date.now()): number {
  return Math.round((Date.parse(date) - Date.parse(damascusToday(now))) / DAY);
}

const FULL_NOTE: Record<string, CommonKey> = {
  [PRACTITIONERS]: 'subFullPractitioners',
  [BRANCHES]: 'subFullBranches',
};

function LimitLine({ limit }: { limit: LimitUse }) {
  const text = useText();
  const label = keyWord(text, limit.key);
  if (limit.used === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 text-data">{label}</span>
        <strong className="text-data tabular-nums">
          {text('subUpTo', { limit: limit.limit })}
        </strong>
      </div>
    );
  }
  const use = text('subUse', { used: limit.used, limit: limit.limit });
  const full = isFull(limit);
  const share = limit.limit > 0 ? Math.min(1, limit.used / limit.limit) : 1;
  const note = FULL_NOTE[limit.key];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-data">{label}</span>
        <strong className="text-data tabular-nums">{use}</strong>
      </div>
      <div
        role="img"
        aria-label={use}
        className="h-(--shifa-space-2) overflow-hidden rounded-full border border-border-default bg-bg-surface-raised"
      >
        <span
          className={cn(
            'block h-full rounded-full',
            full ? 'bg-status-warning-solid' : 'bg-brand-primary',
          )}
          style={{ width: `${String(Math.round(share * 100))}%` }}
        />
      </div>
      {full && (
        <span className="text-caption leading-body text-text-muted">
          {note ? text(note) : text('subFullOther', { item: label })}
        </span>
      )}
    </div>
  );
}

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-caption leading-body text-text-muted">{label}</span>
      <span className="text-data">{children}</span>
    </div>
  );
}

export function SubscriptionCard({ tenantId }: { tenantId: string }) {
  const text = useText();
  // A support session never reads the card (spec: «–»; the server refuses it, A-02-05).
  const support = useReadOnly();
  const { data, isError, isPending, refetch } = useSubscription(tenantId, !support);
  if (support || data === null) return null;
  const days = data?.subscriptionEnd ? daysUntil(data.subscriptionEnd) : null;
  return (
    <Card className="gap-4 p-(--shifa-card-padding)">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-heading-sm leading-heading font-semibold">{text('subTitle')}</h2>
        <p className="m-0 text-data leading-body text-text-muted">{text('subText')}</p>
      </div>
      {isError ? (
        <LoadFailed retry={refetch} />
      ) : isPending ? (
        <SkeletonGroup label={text('subLoading')}>
          <SkeletonText lines={4} />
        </SkeletonGroup>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 border-y border-border-default py-2">
            <Kpi label={text('subPlan')}>
              <strong>{text(TYPE_WORD[data.plan])}</strong>
            </Kpi>
            <Kpi label={text('subStatus')}>
              <Badge tone={STATUS_TONE[data.status]}>{text(STATUS_WORD[data.status])}</Badge>
            </Kpi>
            <Kpi label={text('subEnd')}>
              <span className="tabular-nums">
                {data.subscriptionEnd ? calendarDate(data.subscriptionEnd) : text('subNoEnd')}
              </span>
            </Kpi>
          </div>
          {days !== null && days >= 0 && days <= ENDING_DAYS && data.subscriptionEnd && (
            <Callout tone="warning" title={text('subEndingTitle', { count: days })}>
              {text('subEndingText', { date: calendarDate(data.subscriptionEnd) })}
            </Callout>
          )}
          {data.limits.map((l) => (
            <LimitLine key={l.key} limit={l} />
          ))}
          <div className="flex flex-col gap-1">
            <span className="text-data">{text('subFeatures')}</span>
            {data.features.length === 0 ? (
              <span className="text-caption leading-body text-text-muted">
                {text('subNoFeatures')}
              </span>
            ) : (
              <ul className="m-0 flex flex-wrap gap-2 p-0">
                {data.features.map((f) => (
                  <li key={f} className="list-none">
                    <Badge tone="neutral">{keyWord(text, f)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
