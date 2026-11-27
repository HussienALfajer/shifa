// «الإعلانات» (slice A-02-09 checkpoint 2; drawing `A02Announcements` on "Shifa Screens · Admin
// web", approved in A-02-01; A-02 criteria 16, 22; contract rows "Announcements · list" and "· end
// early or cancel"): the list by status (active first) with each status's count; each row its
// level, body, author, period, state, targets and how many targeted members dismissed it; «تعديل»
// and «إنهاء الآن» (or «إلغاء» before its start) while it has not ended. States: none at all,
// none in a status, loading, failed.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Badge,
  Button,
  Card,
  EmptyState,
  SegmentedControl,
  SkeletonGroup,
  SkeletonText,
} from '@shifa/ui';
import { useState } from 'react';
import { listOf } from '../../chooser/chooser-text.ts';
import { errorFacts } from '../../client.ts';
import { useShell } from '../../providers.tsx';
import { useText } from '../../text.ts';
import { type AdminNote, NoteCallout, useMoment, useWhen } from '../a02.tsx';
import { AdminFrame } from '../admin-frame.tsx';
import { AnnouncementDialog } from './announcement-dialog.tsx';
import {
  type Announcement,
  type AnnouncementStatus,
  FILTER_WORD,
  LEVEL_WORD,
  NONE_WORDS,
  STATUSES,
  useAnnouncements,
} from './data.ts';

// Twelve columns: the level 1, the body 4, the period 2, the targets 3, the actions 2.
const GRID = 'grid grid-cols-12 items-start gap-4 px-4 py-3';
const CELL = 'flex min-w-0 flex-col gap-0.5';

function AnnouncementRow({
  item,
  onEdit,
  onEnd,
}: {
  item: Announcement;
  onEdit: () => void;
  onEnd: () => void;
}) {
  const text = useText();
  const when = useWhen();
  const moment = useMoment();
  const meta =
    item.createdByName === null
      ? text('annMetaUnknown', { when: when(item.createdAt) })
      : text('annMeta', { name: item.createdByName, when: when(item.createdAt) });
  const period = text('annPeriod', {
    start: moment(item.startsAt),
    end: item.endsAt === null ? text('annNoEnd') : moment(item.endsAt),
  });
  const state =
    item.status === 'active'
      ? text('annStateActive')
      : item.status === 'scheduled'
        ? text('annStateScheduled')
        : !item.endedEarly
          ? text('annStateEnded')
          : item.endedByName === null
            ? text('annStateEndedEarlyUnknown')
            : text('annStateEndedEarly', { name: item.endedByName });
  const names = item.clinics.map((c) => c.name);
  const targets =
    item.target === 'all'
      ? text('annTargetAll')
      : names.length <= 2
        ? listOf(names)
        : text('annTargetCount', { count: names.length });
  const seen =
    item.dismissedCount === null || item.targetedMembers === null
      ? ''
      : text('annSeen', { dismissed: item.dismissedCount, count: item.targetedMembers });
  return (
    <div data-row className={`${GRID} border-t border-border-default text-data leading-body`}>
      <div className="col-span-1">
        <Badge tone={item.level === 'warning' ? 'warning' : 'info'} size="sm">
          {text(LEVEL_WORD[item.level])}
        </Badge>
      </div>
      <div className={`col-span-4 ${CELL}`}>
        <span className="break-words">{item.body}</span>
        <span className="text-caption text-text-muted">{meta}</span>
      </div>
      <div className={`col-span-2 ${CELL}`}>
        <span className="tabular-nums">{period}</span>
        <span className="text-caption text-text-muted">{state}</span>
      </div>
      <div className={`col-span-3 ${CELL}`}>
        <span>{targets}</span>
        {seen !== '' && <span className="text-caption text-text-muted">{seen}</span>}
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-end gap-1">
        {item.status !== 'ended' && (
          <>
            <Button
              variant="ghost"
              size="sm"
              aria-label={text('annEditOf', { body: item.body })}
              onClick={onEdit}
            >
              {text('annEdit')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={text(item.status === 'scheduled' ? 'annCancelOf' : 'annEndOf', {
                body: item.body,
              })}
              onClick={onEnd}
            >
              {text(item.status === 'scheduled' ? 'annCancel' : 'annEndNow')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function EndDialog({
  item,
  onDone,
  onClose,
}: {
  item: Announcement;
  onDone: (note: AdminNote) => void;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const [failure, setFailure] = useState('');
  const cancel = item.status === 'scheduled';
  async function end() {
    setFailure(`${text('unreachableTitle')}. ${text('loadFailedText')}`);
    const { data, error, response } = await shell.api.POST('/platform/announcements/{id}/end', {
      params: { path: { id: item.id } },
    });
    if (data) {
      onDone({ tone: 'success', title: text('annEndedTitle'), text: text('annEndedText') });
      return;
    }
    if (errorFacts(error).code === 'announcement_ended' || response.status === 404) {
      onDone({ tone: 'warning', title: text('annGoneTitle'), text: text('annGoneText') });
      return;
    }
    setFailure(text('serverErrorText'));
    throw new Error(`end answered ${String(response.status)}`);
  }
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent
        title={text(cancel ? 'annCancelTitle' : 'annEndTitle')}
        description={text(cancel ? 'annCancelText' : 'annEndText', { body: item.body })}
      >
        <AlertDialogCancel>{text('back')}</AlertDialogCancel>
        <AlertDialogAction variant="danger" errorText={failure} onAction={end}>
          {text(cancel ? 'annCancelAction' : 'annEndNow')}
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type Open = { kind: 'form'; item?: Announcement } | { kind: 'end'; item: Announcement } | null;

export function AnnouncementsPage() {
  const text = useText();
  const [status, setStatus] = useState<AnnouncementStatus>('active');
  const { data, isPending, isPlaceholderData, isError, refetch } = useAnnouncements(status);
  const [open, setOpen] = useState<Open>(null);
  const [note, setNote] = useState<AdminNote | null>(null);
  const counts = data?.counts;
  const nothing = counts !== undefined && counts.scheduled + counts.active + counts.ended === 0;
  const create = (
    <Button
      variant="primary"
      startIcon="plus"
      onClick={() => {
        setNote(null);
        setOpen({ kind: 'form' });
      }}
    >
      {text('annNew')}
    </Button>
  );
  const done = (next: AdminNote) => {
    setOpen(null);
    setNote(next);
    void refetch();
  };
  const rows = data?.announcements ?? [];
  const [noneTitle, noneText] = NONE_WORDS[status];
  return (
    <AdminFrame title={text('annTitle')} description={text('annText')} actions={create}>
      <NoteCallout note={note} />
      {isError && !data ? (
        <Card className="p-4">
          <EmptyState
            icon="wifi-slash"
            title={text('loadFailedTitle')}
            description={text('loadFailedText')}
            headingLevel={2}
            actions={
              <Button variant="secondary" onClick={() => void refetch()}>
                {text('retry')}
              </Button>
            }
          />
        </Card>
      ) : nothing ? (
        <Card className="p-4">
          <EmptyState
            art="jasmine"
            title={text('annEmptyTitle')}
            description={text('annEmptyText')}
            headingLevel={2}
            actions={create}
          />
        </Card>
      ) : (
        <>
          <div>
            <SegmentedControl
              aria-label={text('annFilter')}
              value={status}
              onValueChange={(next) => {
                setStatus(next as AnnouncementStatus);
              }}
              items={STATUSES.map((s) => ({
                value: s,
                label: text(FILTER_WORD[s]),
                ...(counts === undefined ? {} : { count: counts[s] }),
              }))}
            />
          </div>
          <Card className="overflow-hidden">
            {/* The previous status's counts stay while another loads; its rows never do. */}
            {isPending || isPlaceholderData ? (
              <div className="p-4">
                <SkeletonGroup label={text('loading')}>
                  <SkeletonText lines={4} />
                </SkeletonGroup>
              </div>
            ) : rows.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon="calendar"
                  title={text(noneTitle)}
                  description={text(noneText)}
                  headingLevel={2}
                />
              </div>
            ) : (
              rows.map((item) => (
                <AnnouncementRow
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    setNote(null);
                    setOpen({ kind: 'form', item });
                  }}
                  onEnd={() => {
                    setNote(null);
                    setOpen({ kind: 'end', item });
                  }}
                />
              ))
            )}
          </Card>
        </>
      )}
      {open?.kind === 'form' && (
        <AnnouncementDialog
          {...(open.item ? { item: open.item } : {})}
          onDone={done}
          onClose={() => {
            setOpen(null);
          }}
        />
      )}
      {open?.kind === 'end' && (
        <EndDialog
          item={open.item}
          onDone={done}
          onClose={() => {
            setOpen(null);
          }}
        />
      )}
    </AdminFrame>
  );
}
