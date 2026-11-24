// «العيادات», admin web's home (slice A-01-10 checkpoint 3; prototype `Main`, approved 2026-11-24;
// A-01a criterion 3). GET /platform/clinics?search= (newest first): the name as a link to the
// clinic, type and status in words, the subscription end with «ينتهي خلال 5 أيام» when it ends
// within a week (improvement g), the owner and «لم يُكمل الإعداد» for a pending one, the creation
// date. Search goes to the server (after a pause in typing); the status filter with counts works
// on the answer (improvement f). States: loading, empty, no match, no connection.
import type { CommonKey } from '@shifa/i18n';
import {
  Badge,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Input,
  SegmentedControl,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { LoadFailed } from '../account/load-failed.tsx';
import { dayDate } from '../auth/dates.ts';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import { AdminFrame } from './admin-frame.tsx';
import { ButtonLink } from './button-link.tsx';
import {
  type ClinicStatus,
  type ClinicSummary,
  calendarDate,
  clinicsQuery,
  daysUntil,
  ENDS_SOON_DAYS,
  STATUS_TONE,
  STATUS_WORD,
  STATUSES,
  TYPE_WORD,
  useClinics,
} from './data.ts';

const SEARCH_PAUSE_MS = 250;

type Filter = 'all' | ClinicStatus;

const FILTER_WORD = {
  trial: 'clinicsFilterTrial',
  active: 'clinicsFilterActive',
  suspended: 'clinicsFilterSuspended',
} as const satisfies Record<ClinicStatus, CommonKey>;

function useColumns(): DataTableColumn<ClinicSummary>[] {
  const text = useText();
  return [
    {
      id: 'name',
      header: text('colClinic'),
      width: 'lg',
      value: (c) => c.name,
      cell: (c) => (
        <Link to="/clinics/$id" params={{ id: c.id }} className="font-medium text-brand-primary">
          {c.name}
        </Link>
      ),
    },
    { id: 'type', header: text('colType'), value: (c) => text(TYPE_WORD[c.type]) },
    {
      id: 'status',
      header: text('colStatus'),
      value: (c) => text(STATUS_WORD[c.status]),
      cell: (c) => (
        <Badge tone={STATUS_TONE[c.status]} size="sm">
          {text(STATUS_WORD[c.status])}
        </Badge>
      ),
    },
    {
      id: 'end',
      header: text('colEnd'),
      value: (c) => c.subscriptionEnd ?? '',
      cell: (c) => {
        if (c.subscriptionEnd === null)
          return <span className="text-text-muted">{text('noEnd')}</span>;
        const days = daysUntil(c.subscriptionEnd);
        return (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="tabular-nums">{calendarDate(c.subscriptionEnd)}</span>
            {days >= 0 && days <= ENDS_SOON_DAYS && (
              <Badge tone="warning" size="sm">
                {text('endsInDays', { count: days })}
              </Badge>
            )}
          </span>
        );
      },
    },
    {
      id: 'owner',
      header: text('colOwner'),
      width: 'md',
      value: (c) => c.ownerName ?? '',
      cell: (c) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{c.ownerName ?? text('noOwner')}</span>
          {c.ownerStatus === 'pending' && (
            <Badge tone="neutral" size="sm">
              {text('ownerPendingShort')}
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: 'created',
      header: text('colCreated'),
      value: (c) => c.createdAt,
      cell: (c) => <span className="tabular-nums">{dayDate(Date.parse(c.createdAt))}</span>,
    },
  ];
}

export function ClinicsPage() {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      const next = typed.trim();
      // The answer first, then the switch: the table goes from the old rows to the new ones
      // without a moment of stale rows under a new search. A failure shows on the switch.
      void queryClient
        .query(clinicsQuery(shell, next))
        .catch(() => undefined)
        .finally(() => {
          if (live) setSearch(next);
        });
    }, SEARCH_PAUSE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [typed, queryClient, shell]);
  const { data, isError, isPending, refetch } = useClinics(search);
  const columns = useColumns();
  const all = data ?? [];
  const count = (s: ClinicStatus) => all.filter((c) => c.status === s).length;
  const rows = filter === 'all' ? all : all.filter((c) => c.status === filter);
  const nothingYet = !isPending && search === '' && all.length === 0;
  const create = (
    <ButtonLink to="/clinics/new" variant="primary" icon="plus">
      {text('clinicsCreate')}
    </ButtonLink>
  );
  return (
    <AdminFrame title={text('clinicsTitle')} description={text('clinicsText')} actions={create}>
      {isError && !data ? (
        <LoadFailed retry={refetch} />
      ) : nothingYet ? (
        <EmptyState
          title={text('clinicsEmptyTitle')}
          description={text('clinicsEmptyText')}
          actions={create}
        />
      ) : (
        <DataTable
          aria-label={text('clinicsTitle')}
          columns={columns}
          rows={rows}
          getRowId={(c) => c.id}
          loading={isPending}
          loadingRows={5}
          empty={{
            title: text('clinicsNoMatchTitle'),
            description: text('clinicsNoMatchText'),
            icon: 'magnifying-glass',
          }}
          toolbar={
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <Input
                type="search"
                aria-label={text('clinicsSearch')}
                placeholder={text('clinicsSearch')}
                startIcon="magnifying-glass"
                value={typed}
                onValueChange={setTyped}
                className="max-w-(--shifa-width-80) flex-1"
              />
              <SegmentedControl
                aria-label={text('clinicsFilter')}
                value={filter}
                onValueChange={(next) => {
                  setFilter(next as Filter);
                }}
                items={[
                  { value: 'all', label: text('clinicsFilterAll', { count: all.length }) },
                  ...STATUSES.map((s) => ({
                    value: s,
                    label: text(FILTER_WORD[s], { count: count(s) }),
                  })),
                ]}
              />
            </div>
          }
        />
      )}
    </AdminFrame>
  );
}
