// «الاشتراك والحدود» on the clinic page (slice A-02-08; board `A02Clinic`, states `sub` …
// `typeSaved`; A-02 criteria 1, 3, 20): the plan from the type with «تغيير النوع», and each
// catalogue key with its plan value, override (an active one with «حتى …» and its reason, an
// expired one struck through with «انتهى …»), effective value and use («—» while a key is not
// counted); per key «تجاوز» or «تعديل», «إزالة» (asked first) and «السجل».
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Badge,
  Button,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import {
  type EntitlementItem,
  type Entitlements,
  entitlementsKey,
  entitlementWord,
  keyWord,
  useEntitlements,
} from './clinic-data.ts';
import { type ClinicDetail, calendarDate, clinicKey, TYPE_WORD } from './data.ts';
import { OverrideDialog } from './override-dialog.tsx';
import { OverrideHistory } from './override-history.tsx';
import {
  GridRow,
  KeyCell,
  NoteCallout,
  TabCard,
  TabFailed,
  TabLoading,
  type TabNote,
  TabStack,
} from './tab-parts.tsx';
import { TypeDialog } from './type-dialog.tsx';

const COLUMNS =
  'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 1fr) var(--shifa-width-60)';

type Open =
  | { kind: 'override'; item: EntitlementItem }
  | { kind: 'remove'; item: EntitlementItem }
  | { kind: 'history'; item: EntitlementItem }
  | { kind: 'type' };

const shown = entitlementWord;

function OverrideCell({ item }: { item: EntitlementItem }) {
  const text = useText();
  const o = item.override;
  if (o === null) return <span className="text-text-muted">{text('overrideNone')}</span>;
  const until = o.expiresAt === null ? text('overrideNoEnd') : calendarDate(o.expiresAt);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className={o.expired ? 'text-text-muted tabular-nums line-through' : 'tabular-nums'}>
          {shown(text, o.value)}
        </span>
        <Badge tone={o.expired ? 'neutral' : 'info'}>
          {o.expired
            ? text('overrideExpiredOn', { date: until })
            : o.expiresAt === null
              ? until
              : text('overrideUntil', { date: until })}
        </Badge>
      </div>
      <span className="text-caption leading-heading text-text-muted">
        {o.expired ? text('overrideNoLongerCounts', { reason: o.reason }) : o.reason}
      </span>
    </div>
  );
}

export function LimitsTab({ clinic }: { clinic: ClinicDetail }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const { data, isError, isPending, refetch } = useEntitlements(clinic.id);
  const [open, setOpen] = useState<Open | null>(null);
  const [note, setNote] = useState<TabNote | null>(null);
  const close = useCallback(() => {
    setOpen(null);
  }, []);
  const gone = useCallback(() => {
    setOpen(null);
    setNote({ tone: 'warning', title: text('overrideGoneTitle'), text: text('overrideGoneText') });
    void refetch();
  }, [refetch, text]);

  const put = (saved: EntitlementItem) => {
    queryClient.setQueryData<Entitlements | null>(entitlementsKey(clinic.id), (old) =>
      old ? { ...old, items: old.items.map((i) => (i.key === saved.key ? saved : i)) } : old,
    );
    void queryClient.invalidateQueries({ queryKey: ['platform', 'clinic', clinic.id, 'history'] });
    // The type preview counts overrides: drop the one cached before this change.
    queryClient.removeQueries({ queryKey: ['platform', 'clinic', clinic.id, 'type-preview'] });
  };

  async function remove(item: EntitlementItem) {
    const { data: saved, response } = await shell.api.DELETE(
      '/platform/clinics/{id}/overrides/{key}',
      { params: { path: { id: clinic.id, key: item.key } } },
    );
    if (saved) {
      put(saved);
      setNote({
        tone: 'success',
        title: text('overrideRemovedTitle'),
        text: text('overrideRemovedText', {
          name: keyWord(text, item.key),
          value: shown(text, saved.effective),
        }),
      });
      return;
    }
    if (response.status === 404) {
      gone();
      return;
    }
    throw new Error('DELETE override failed');
  }

  if (isPending) return <TabLoading label="limitsLoading" />;
  if (isError || !data) return <TabFailed retry={refetch} />;

  const removeText = (item: EntitlementItem) => {
    const values = {
      name: keyWord(text, item.key),
      plan: shown(text, item.planValue),
      used: String(item.used ?? ''),
    };
    if (item.used === null || typeof item.planValue !== 'number') {
      return text('overrideRemovePlain', values);
    }
    return text(item.used > item.planValue ? 'overrideRemoveOver' : 'overrideRemoveFits', values);
  };

  return (
    <TabStack>
      <NoteCallout note={note} />
      <TabCard
        title={text('planTitle')}
        text={text('planText', { plan: text(TYPE_WORD[data.plan]) })}
        actions={
          <Button
            variant="secondary"
            startIcon="pencil"
            onClick={() => {
              setNote(null);
              setOpen({ kind: 'type' });
            }}
          >
            {text('typeChange')}
          </Button>
        }
      />
      <TabCard title={text('limitsTitle')} text={text('limitsText')}>
        <div>
          <GridRow columns={COLUMNS} head>
            <span>{text('limitColKey')}</span>
            <span>{text('limitColPlan')}</span>
            <span>{text('limitColOverride')}</span>
            <span>{text('limitColEffective')}</span>
            <span>{text('limitColUsed')}</span>
            <span />
          </GridRow>
          {data.items.map((item) => (
            <GridRow key={item.key} columns={COLUMNS} rowKey={item.key}>
              <KeyCell word={keyWord(text, item.key)} code={item.key} />
              <span className="tabular-nums">{shown(text, item.planValue)}</span>
              <OverrideCell item={item} />
              <strong className="font-semibold tabular-nums" data-effective>
                {shown(text, item.effective)}
              </strong>
              <span className="tabular-nums">{item.used === null ? '—' : String(item.used)}</span>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNote(null);
                    setOpen({ kind: 'override', item });
                  }}
                >
                  {text(item.override === null ? 'overrideAdd' : 'overrideEdit')}
                </Button>
                {item.override !== null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNote(null);
                      setOpen({ kind: 'remove', item });
                    }}
                  >
                    {text('overrideRemove')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOpen({ kind: 'history', item });
                  }}
                >
                  {text('overrideHistory')}
                </Button>
              </div>
            </GridRow>
          ))}
        </div>
        <p className="m-0 text-caption leading-heading text-text-muted">{text('limitsCaption')}</p>
      </TabCard>

      {open?.kind === 'override' && (
        <OverrideDialog
          clinicId={clinic.id}
          item={open.item}
          onSaved={(saved, next) => {
            put(saved);
            setOpen(null);
            setNote(next);
          }}
          onGone={gone}
          onClose={close}
        />
      )}
      {open?.kind === 'history' && (
        <OverrideHistory
          clinicId={clinic.id}
          itemKey={open.item.key}
          name={keyWord(text, open.item.key)}
          onGone={gone}
          onClose={close}
        />
      )}
      {open?.kind === 'type' && (
        <TypeDialog
          clinic={clinic}
          items={data.items}
          onSaved={(saved, next) => {
            queryClient.setQueryData(clinicKey(clinic.id), saved);
            void queryClient.invalidateQueries({ queryKey: ['platform', 'clinic', clinic.id] });
            void queryClient.invalidateQueries({ queryKey: ['platform', 'clinics'] });
            setOpen(null);
            setNote(next);
          }}
          onClose={close}
        />
      )}
      <AlertDialog
        open={open?.kind === 'remove'}
        onOpenChange={(o) => {
          if (!o) setOpen(null);
        }}
      >
        {open?.kind === 'remove' && (
          <AlertDialogContent
            tone="danger"
            title={text('overrideRemoveTitle', { name: keyWord(text, open.item.key) })}
            description={removeText(open.item)}
          >
            <AlertDialogCancel>{text('back')}</AlertDialogCancel>
            <AlertDialogAction
              errorText={text('serverErrorText')}
              onAction={() => remove(open.item)}
            >
              {text('overrideRemoveAction')}
            </AlertDialogAction>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </TabStack>
  );
}
