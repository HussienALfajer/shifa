// «سجل دخول الدعم» on the clinic page (slice A-02-08; board `A02Clinic`; A-02 criteria 11, 13):
// every grant on the clinic, newest first, in the DataTable with «السبب» as a wrapping column, so
// each reason shows whole; the state is «مفتوح», «انتهت المدة», «أنهاه المالك: …» or «أنهاه: …».
import { Badge, DataTable, type DataTableColumn } from '@shifa/ui';
import { dayDate } from '../auth/dates.ts';
import { clockTime } from '../auth/lock.ts';
import { useText } from '../text.ts';
import type { SupportGrant } from './clinic-data.ts';

const at = (iso: string) => {
  const t = Date.parse(iso);
  return `${dayDate(t)} ${clockTime(t)}`;
};

function useColumns(): DataTableColumn<SupportGrant>[] {
  const text = useText();
  const state = (g: SupportGrant) => {
    if (g.endedBy === null) return text('supportStateOpen');
    if (g.endedBy === 'expiry') return text('supportByExpiry');
    if (g.endedBy === 'owner') return text('supportByOwner', { name: g.endedByName ?? '' });
    return text('supportByAdmin', { name: g.endedByName ?? g.adminName });
  };
  return [
    { id: 'who', header: text('supportColWho'), width: 'md', value: (g) => g.adminName },
    { id: 'reason', header: text('supportColReason'), wrap: true, value: (g) => g.reason },
    {
      id: 'start',
      header: text('supportColStart'),
      kind: 'number',
      value: (g) => g.startedAt,
      cell: (g) => <span className="tabular-nums">{at(g.startedAt)}</span>,
    },
    {
      id: 'end',
      header: text('supportColEnd'),
      kind: 'number',
      value: (g) => g.endedAt ?? g.expiresAt,
      cell: (g) => (
        <span className="tabular-nums">
          {g.endedAt === null
            ? text('supportUntil', { time: clockTime(Date.parse(g.expiresAt)) })
            : at(g.endedAt)}
        </span>
      ),
    },
    {
      id: 'state',
      header: text('supportColState'),
      value: state,
      cell: (g) =>
        g.endedBy === null ? (
          <Badge tone="info">{state(g)}</Badge>
        ) : (
          <span className="text-text-muted">{state(g)}</span>
        ),
    },
  ];
}

export function SupportLog({ grants }: { grants: readonly SupportGrant[] }) {
  const text = useText();
  return (
    <DataTable
      aria-label={text('supportLogTitle')}
      columns={useColumns()}
      rows={grants}
      getRowId={(g) => g.id}
      empty={{ title: text('supportLogEmpty'), icon: 'clock' }}
    />
  );
}
