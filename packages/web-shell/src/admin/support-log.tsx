// «سجل دخول الدعم» (slice A-02-08 on admin web's clinic page, board `A02Clinic`; A-02-10 on clinic
// web's settings for the owner, board `A02cSettings`; A-02 criteria 11, 13, 26): every grant on the
// clinic, newest first, in the DataTable with «السبب» as a wrapping column, so each reason shows
// whole. For the super admin the state is «مفتوح», «انتهت المدة», «أنهاه المالك: …» or «أنهاه: …»;
// for the owner «من» reads «… · فريق شفاء» and the state «أنهيته أنت», «أنهاه …» or «أنهاه فريق
// شفاء», with its own empty state.
import { Badge, DataTable, type DataTableColumn } from '@shifa/ui';
import { dayDate } from '../auth/dates.ts';
import { clockTime } from '../auth/lock.ts';
import { useText } from '../text.ts';
import type { SupportGrant } from './clinic-data.ts';

export type LogViewer = 'admin' | 'owner';

const at = (iso: string) => {
  const t = Date.parse(iso);
  return `${dayDate(t)} ${clockTime(t)}`;
};

function useStateWord(viewer: LogViewer, selfName: string | undefined) {
  const text = useText();
  return (g: SupportGrant) => {
    if (g.endedBy === null) return text('supportStateOpen');
    if (g.endedBy === 'expiry') return text('supportByExpiry');
    if (viewer === 'owner') {
      if (g.endedBy === 'admin') return text('ownerLogByAdmin');
      if (g.endedByName === null || g.endedByName === selfName) return text('ownerLogBySelf');
      return text('ownerLogByOwner', { name: g.endedByName });
    }
    if (g.endedBy === 'owner') return text('supportByOwner', { name: g.endedByName ?? '' });
    // The super admin who opened it ended it: the name is already in «من».
    if (g.endedByName === null || g.endedByName === g.adminName) return text('supportBySelf');
    return text('supportByAdmin', { name: g.endedByName });
  };
}

function useColumns(
  viewer: LogViewer,
  selfName: string | undefined,
): DataTableColumn<SupportGrant>[] {
  const text = useText();
  const state = useStateWord(viewer, selfName);
  const who = (g: SupportGrant) =>
    viewer === 'owner' ? text('ownerLogWho', { name: g.adminName }) : g.adminName;
  return [
    { id: 'who', header: text('supportColWho'), width: 'md', value: who },
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

export function SupportLog({
  grants,
  viewer = 'admin',
  selfName,
}: {
  grants: readonly SupportGrant[];
  viewer?: LogViewer;
  /** The owner's own name: «أنهيته أنت» on the grants they ended. */
  selfName?: string;
}) {
  const text = useText();
  return (
    <DataTable
      aria-label={text('supportLogTitle')}
      columns={useColumns(viewer, selfName)}
      rows={grants}
      getRowId={(g) => g.id}
      empty={
        viewer === 'owner'
          ? {
              title: text('ownerLogEmptyTitle'),
              description: text('ownerLogEmptyText'),
              icon: 'eye',
            }
          : { title: text('supportLogEmpty'), icon: 'clock' }
      }
    />
  );
}
