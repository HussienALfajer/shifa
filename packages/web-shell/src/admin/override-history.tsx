// «السجل» of one limit (slice A-02-08; board `A02Clinic`, state `history`; A-02 criterion 20): every
// change of the key for the clinic, newest first, from `tenant_override_event`: set, changed,
// removed, expired and type changes, with who, when, the values before and after and the reason.
// A key or clinic gone meanwhile closes the drawer and reloads the list.
import { Badge, Drawer, DrawerContent, SkeletonGroup, SkeletonText } from '@shifa/ui';
import { useEffect } from 'react';
import { LoadFailed } from '../account/load-failed.tsx';
import { dayDate } from '../auth/dates.ts';
import { clockTime } from '../auth/lock.ts';
import { useText } from '../text.ts';
import { type OverrideEvent, useOverrideHistory } from './clinic-data.ts';
import { calendarDate } from './data.ts';

type Text = ReturnType<typeof useText>;

const KIND = {
  set: { word: 'historySet', tone: 'brand' },
  changed: { word: 'historyChanged', tone: 'info' },
  removed: { word: 'historyRemoved', tone: 'neutral' },
  expired: { word: 'historyExpired', tone: 'neutral' },
  type_changed: { word: 'historyTypeChanged', tone: 'neutral' },
} as const satisfies Record<OverrideEvent['kind'], { word: string; tone: string }>;

const valueOf = (text: Text, v: number | boolean | undefined) =>
  typeof v === 'boolean' ? text(v ? 'featureOn' : 'featureOff') : String(v ?? '—');

const endOf = (text: Text, expiresAt: string | null | undefined) =>
  expiresAt ? text('overrideUntil', { date: calendarDate(expiresAt) }) : text('overrideNoEnd');

export function changeLine(text: Text, e: OverrideEvent): string {
  const before = valueOf(text, e.before?.value);
  const after = valueOf(text, e.after?.value);
  switch (e.kind) {
    case 'set':
      return `${after} ${endOf(text, e.after?.expiresAt)}`;
    case 'changed':
      return text('historyChangedLine', { before, after, end: endOf(text, e.after?.expiresAt) });
    case 'removed':
      return text('historyRemovedLine', { value: before });
    case 'expired':
      return text('historyExpiredLine', { value: before });
    case 'type_changed':
      return text('historyTypeLine', { before, after });
  }
}

export function OverrideHistory({
  clinicId,
  itemKey,
  name,
  onGone,
  onClose,
}: {
  clinicId: string;
  itemKey: string;
  name: string;
  onGone: () => void;
  onClose: () => void;
}) {
  const text = useText();
  const { data, isPending, isError, refetch } = useOverrideHistory(clinicId, itemKey);
  useEffect(() => {
    if (data === null) onGone();
  }, [data, onGone]);
  return (
    <Drawer
      open
      side="end"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent
        title={text('historyTitle', { name })}
        description={text('historyText')}
        closeLabel={text('close')}
      >
        <span dir="ltr" className="self-start text-caption leading-heading text-text-muted">
          {itemKey}
        </span>
        {isPending ? (
          <SkeletonGroup label={text('historyLoading')}>
            <SkeletonText lines={6} />
          </SkeletonGroup>
        ) : isError ? (
          <LoadFailed retry={refetch} />
        ) : data === null || data.events.length === 0 ? (
          <p className="m-0 text-data leading-body text-text-muted">{text('historyEmpty')}</p>
        ) : (
          <ol className="m-0 flex list-none flex-col p-0">
            {data.events.map((e) => {
              const at = Date.parse(e.at);
              const who =
                e.byName ?? text(e.kind === 'expired' ? 'historyByExpiry' : 'historyByGone');
              return (
                <li
                  key={`${e.kind}-${e.at}`}
                  className="flex flex-col gap-1 border-s-2 border-border-default py-3 ps-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={KIND[e.kind].tone} size="sm">
                      {text(KIND[e.kind].word)}
                    </Badge>
                    <span className="text-caption leading-heading text-text-muted tabular-nums">
                      {`${dayDate(at)} ${clockTime(at)} · ${who}`}
                    </span>
                  </div>
                  <span className="text-data leading-body">{changeLine(text, e)}</span>
                  {e.reason !== null && (
                    <span className="text-caption leading-heading text-text-muted">
                      {text('historyReason', { reason: e.reason })}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </DrawerContent>
    </Drawer>
  );
}
