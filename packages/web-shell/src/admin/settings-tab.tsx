// «الإعدادات» on the clinic page (slice A-02-08; board `A02Clinic`, states `set` … `setNone`; A-02
// criterion 9): each setting with its effective value and where it comes from («موروث من:
// الإعداد الافتراضي», «من: العيادة», «من: الإدارة»), a lock with «مقفل من الإدارة»; the super admin
// only locks with a value («قفل بقيمة», PUT …/lock) and unlocks («فتح القفل», DELETE, asked
// first), never a plain set. A lock of the platform or plan offers no action.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Badge,
  Button,
  Callout,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  EmptyState,
  Input,
  Select,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import {
  keyWord,
  type SettingView,
  settingsKey,
  sourceWord,
  useClinicSettings,
} from './clinic-data.ts';
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

type Text = ReturnType<typeof useText>;
type Value = SettingView['value'];

const COLUMNS = 'minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 2fr) var(--shifa-width-37-5)';
/** Keys whose value is a count of minutes. */
const MINUTES = new Set(['session.idle_minutes']);

export function valueWord(text: Text, key: string, value: Value): string {
  if (typeof value === 'boolean') return text(value ? 'settingTrue' : 'settingFalse');
  if (typeof value === 'number' && MINUTES.has(key))
    return text('settingMinutes', { count: value });
  return String(value);
}

function LockDialog({
  clinicId,
  setting,
  onLocked,
  onRefused,
  onClose,
}: {
  clinicId: string;
  setting: SettingView;
  onLocked: (saved: SettingView) => void;
  onRefused: () => void;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const [value, setValue] = useState<string>(String(setting.value));
  const [problem, setProblem] = useState<'value' | 'server' | 'network' | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const name = keyWord(text, setting.key);
  // The typed text back to the setting's own type (the choices keep theirs).
  const parsed = (): Value => {
    const choice = setting.choices?.find((c) => String(c) === value);
    if (choice !== undefined) return choice;
    if (typeof setting.value === 'number') return Number(value);
    if (typeof setting.value === 'boolean') return value === 'true';
    return value;
  };

  async function lock() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const { data, response } = await shell.api.PUT('/platform/clinics/{id}/settings/{key}/lock', {
        params: { path: { id: clinicId, key: setting.key } },
        body: { value: parsed() },
      });
      if (data) onLocked(data);
      else if (response.status === 409 || response.status === 404) onRefused();
      else setProblem(response.status === 400 ? 'value' : 'server');
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const error = problem === 'value' ? text('lockValueInvalid') : undefined;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title={text('lockTitle', { name })} closeLabel={text('close')}>
        <div className="flex flex-col gap-4">
          <p className="m-0 text-data leading-body text-text-muted">
            {text('lockNow', {
              value: valueWord(text, setting.key, setting.value),
              source: text(sourceWord(setting)),
            })}
          </p>
          {setting.choices !== null ? (
            <Select
              label={text('lockValue')}
              items={setting.choices.map((c) => ({
                value: String(c),
                label: valueWord(text, setting.key, c),
              }))}
              value={value}
              onValueChange={(v) => {
                if (v !== null) setValue(v);
              }}
              error={error}
            />
          ) : (
            <Input label={text('lockValue')} value={value} onValueChange={setValue} error={error} />
          )}
          <Callout tone="info">{text('lockNote')}</Callout>
          {(problem === 'server' || problem === 'network') && (
            <Callout
              tone="danger"
              icon={problem === 'network' ? 'wifi-slash' : 'warning'}
              title={text(problem === 'network' ? 'unreachableTitle' : 'actionFailedTitle')}
            >
              {text(problem === 'network' ? 'clinicUnknownText' : 'serverErrorText')}
            </Callout>
          )}
          <DialogActions>
            <DialogClose>{text('back')}</DialogClose>
            <Button variant="primary" loading={busy} onClick={() => void lock()}>
              {text('lockAction')}
            </Button>
          </DialogActions>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsTab({ clinicId }: { clinicId: string }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const { data, isError, isPending, refetch } = useClinicSettings(clinicId);
  const [locking, setLocking] = useState<SettingView | null>(null);
  const [unlocking, setUnlocking] = useState<SettingView | null>(null);
  const [note, setNote] = useState<TabNote | null>(null);

  const put = (saved: SettingView) => {
    queryClient.setQueryData<{ settings: SettingView[] } | null>(settingsKey(clinicId), (old) =>
      old ? { settings: old.settings.map((s) => (s.key === saved.key ? saved : s)) } : old,
    );
  };

  async function unlock(setting: SettingView) {
    const { data: saved, response } = await shell.api.DELETE(
      '/platform/clinics/{id}/settings/{key}/lock',
      { params: { path: { id: clinicId, key: setting.key } } },
    );
    if (saved) {
      put(saved);
      setNote({
        tone: 'success',
        title: text('unlockedTitle'),
        text: text('lockNow', {
          value: valueWord(text, saved.key, saved.value),
          source: text(sourceWord(saved)),
        }),
      });
      return;
    }
    if (response.status === 404) {
      setUnlocking(null);
      void refetch();
      return;
    }
    throw new Error('DELETE lock failed');
  }

  if (isPending) return <TabLoading label="clinicSettingsLoading" />;
  if (isError || !data) return <TabFailed retry={refetch} />;
  if (data.settings.length === 0) {
    return (
      <TabStack>
        <TabCard>
          <EmptyState
            art="star"
            title={text('clinicSettingsNoneTitle')}
            description={text('clinicSettingsNoneText')}
          />
        </TabCard>
      </TabStack>
    );
  }

  return (
    <TabStack>
      <NoteCallout note={note} />
      <TabCard title={text('clinicSettingsTitle')} text={text('clinicSettingsText')}>
        <div>
          <GridRow columns={COLUMNS} head>
            <span>{text('settingColKey')}</span>
            <span>{text('settingColValue')}</span>
            <span>{text('settingColSource')}</span>
            <span />
          </GridRow>
          {data.settings.map((s) => {
            const mine = s.locked && s.lockedBy === 'organization';
            return (
              <GridRow key={s.key} columns={COLUMNS} rowKey={s.key}>
                <KeyCell word={keyWord(text, s.key)} code={s.key} />
                <strong className="font-semibold tabular-nums">
                  {valueWord(text, s.key, s.value)}
                </strong>
                <div className="flex flex-wrap items-center gap-2">
                  {s.locked && (
                    <Badge tone="warning" icon="clock">
                      {text('settingLocked')}
                    </Badge>
                  )}
                  <span className="text-text-muted">{text(sourceWord(s))}</span>
                </div>
                <div className="flex items-center gap-1">
                  {mine ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNote(null);
                        setUnlocking(s);
                      }}
                    >
                      {text('settingUnlock')}
                    </Button>
                  ) : (
                    s.lockable &&
                    !s.locked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setNote(null);
                          setLocking(s);
                        }}
                      >
                        {text('settingLock')}
                      </Button>
                    )
                  )}
                </div>
              </GridRow>
            );
          })}
        </div>
      </TabCard>
      {locking !== null && (
        <LockDialog
          clinicId={clinicId}
          setting={locking}
          onLocked={(saved) => {
            put(saved);
            setLocking(null);
            setNote({
              tone: 'success',
              title: text('lockedTitle', { value: valueWord(text, saved.key, saved.value) }),
              text: text('lockedText'),
            });
          }}
          onRefused={() => {
            setLocking(null);
            setNote({
              tone: 'danger',
              icon: 'warning',
              title: text('notLockableTitle'),
              text: text('notLockableText'),
            });
            void refetch();
          }}
          onClose={() => {
            setLocking(null);
          }}
        />
      )}
      <AlertDialog
        open={unlocking !== null}
        onOpenChange={(o) => {
          if (!o) setUnlocking(null);
        }}
      >
        {unlocking !== null && (
          <AlertDialogContent
            tone="info"
            title={text('unlockTitle')}
            description={text('unlockText')}
          >
            <AlertDialogCancel>{text('back')}</AlertDialogCancel>
            <AlertDialogAction
              variant="primary"
              errorText={text('serverErrorText')}
              onAction={() => unlock(unlocking)}
            >
              {text('settingUnlock')}
            </AlertDialogAction>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </TabStack>
  );
}
