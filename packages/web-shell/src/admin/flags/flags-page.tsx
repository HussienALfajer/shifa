// «الميزات التجريبية» (slice A-02-09 checkpoint 2; drawing `A02Flags` on "Shifa Screens · Admin
// web", approved in A-02-01; A-02 criterion 7; contract row "Flags · list"): every flag declared
// in code with its key, description and code default; its mode as a badge (danger «مطفأة
// للجميع» for a kill switch, neutral for a default never changed), its clinics, the reason and
// who changed it last; «تغيير» opens the dialog. States: loading, failed, none declared.
import { Badge, Button, Card, EmptyState, SkeletonGroup, SkeletonText } from '@shifa/ui';
import { useState } from 'react';
import { listOf } from '../../chooser/chooser-text.ts';
import { useText } from '../../text.ts';
import { type AdminNote, NoteCallout, useWhen } from '../a02.tsx';
import { AdminFrame } from '../admin-frame.tsx';
import { type Flag, flagTitle, MODE_WORD, modeTone, useFlags } from './data.ts';
import { FlagDialog } from './flag-dialog.tsx';

// Twelve columns: the flag 5, its mode 3, the reason 3, «تغيير» 1.
const GRID = 'grid grid-cols-12 items-start gap-4 px-4 py-3';
const COL = ['col-span-5', 'col-span-3', 'col-span-3', 'col-span-1 justify-self-end'] as const;

function FlagRow({ flag, onChange }: { flag: Flag; onChange: () => void }) {
  const text = useText();
  const when = useWhen();
  const title = flagTitle(flag, text);
  const tone = modeTone(flag);
  const names = flag.clinics.map((c) => c.name);
  const clinics =
    flag.mode === 'selected'
      ? listOf(names)
      : names.length > 0 && flag.mode === 'off' && flag.updatedAt !== null
        ? text('flagKeptClinics', { count: names.length })
        : '';
  const by =
    flag.updatedAt === null
      ? text('flagByDefault')
      : flag.updatedByName === null
        ? text('flagByUnknown', { when: when(flag.updatedAt) })
        : text('flagBy', { name: flag.updatedByName, when: when(flag.updatedAt) });
  return (
    <div data-row className={`${GRID} border-t border-border-default text-data leading-body`}>
      <div className={`${COL[0]} flex min-w-0 flex-col gap-0.5`}>
        <strong className="font-semibold">{title}</strong>
        <span dir="ltr" className="self-start font-mono text-caption text-text-muted">
          {flag.key}
        </span>
        <span className="text-caption text-text-muted">
          {text('flagDefault', {
            description: flag.description,
            value: text(flag.defaultValue ? 'flagDefaultOn' : 'flagDefaultOff'),
          })}
        </span>
      </div>
      <div className={`${COL[1]} flex min-w-0 flex-col items-start gap-1`}>
        <span data-badge={tone}>
          <Badge tone={tone} size="sm">
            {text(MODE_WORD[flag.mode])}
          </Badge>
        </span>
        {clinics !== '' && <span className="text-caption text-text-muted">{clinics}</span>}
      </div>
      <div className={`${COL[2]} flex min-w-0 flex-col gap-0.5`}>
        <span>{flag.reason ?? text('flagNeverChanged')}</span>
        <span className="text-caption text-text-muted">{by}</span>
      </div>
      <div className={COL[3]}>
        <Button
          variant="ghost"
          size="sm"
          aria-label={text('flagChangeOf', { name: title })}
          onClick={onChange}
        >
          {text('flagChange')}
        </Button>
      </div>
    </div>
  );
}

export function FlagsPage() {
  const text = useText();
  const { data, isPending, isError, refetch } = useFlags();
  const [editing, setEditing] = useState<Flag | null>(null);
  const [note, setNote] = useState<AdminNote | null>(null);
  return (
    <AdminFrame title={text('flagsTitle')} description={text('flagsText')}>
      <NoteCallout note={note} />
      {isPending ? (
        <Card className="p-4">
          <SkeletonGroup label={text('flagsLoading')}>
            <SkeletonText lines={6} />
          </SkeletonGroup>
        </Card>
      ) : isError ? (
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
      ) : data.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            art="star"
            title={text('flagsNoneTitle')}
            description={text('flagsNoneText')}
            headingLevel={2}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div
            className={`${GRID} bg-bg-surface-raised text-caption font-semibold text-text-muted`}
          >
            <span className={COL[0]}>{text('flagsColFlag')}</span>
            <span className={COL[1]}>{text('flagsColMode')}</span>
            <span className={COL[2]}>{text('flagsColReason')}</span>
            <span className={COL[3]} />
          </div>
          {data.map((flag) => (
            <FlagRow
              key={flag.key}
              flag={flag}
              onChange={() => {
                setNote(null);
                setEditing(flag);
              }}
            />
          ))}
        </Card>
      )}
      {editing && (
        <FlagDialog
          flag={editing}
          onDone={(next) => {
            setEditing(null);
            setNote(next);
            void refetch();
          }}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </AdminFrame>
  );
}
