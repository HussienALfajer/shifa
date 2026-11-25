// «إعدادات العيادة · الخروج التلقائي» (slice A-01-10 checkpoint 2; prototype `Account10`; A-01a
// criterion 9, PLT-48), the clinic's owner only: GET and PATCH /clinic/settings, 15, 30 or 60
// minutes, each with its use. «حفظ» waits for a change (improvement c). Saved: the session is read
// again so this tab's idle timer takes the new limit (the others take it from their next
// request). No answer or an error names the value still in force. A member has no navigation
// item; the address takes them to My account and the setting is never read.
import { Button, Callout, Card, Radio, RadioGroup, SkeletonGroup, SkeletonText } from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { SettingsBranchesCard } from '../branches/settings-branches.tsx';
import { useShell } from '../providers.tsx';
import { sessionQueryKey } from '../session.ts';
import { useText } from '../text.ts';
import type { Note } from './account-page.tsx';
import { AppFrame } from './app-frame.tsx';
import { isOwner, settingsKey, useActiveClinic, useClinicSettings, useSignedIn } from './data.ts';
import { LoadFailed } from './load-failed.tsx';

type Minutes = 15 | 30 | 60;
const CHOICES = [
  { value: 15, use: 'idleUse15' },
  { value: 30, use: 'idleUse30' },
  { value: 60, use: 'idleUse60' },
] as const;
/** Super admins' fixed idle limit (A-01a criterion 9). */
const ADMIN_MINUTES = 15;

function IdleCard({ tenantId }: { tenantId: string }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const { data, isError, refetch } = useClinicSettings(tenantId, true);
  const [picked, setPicked] = useState<Minutes | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const saved = data?.idleMinutes;
  const value = picked ?? saved;

  async function save() {
    if (value === undefined || saved === undefined || value === saved) return;
    setBusy(true);
    setNote(null);
    try {
      const { data: next } = await shell.api.PATCH('/clinic/settings', {
        body: { idleMinutes: value },
      });
      if (!next) {
        setNote({
          tone: 'danger',
          title: text('idleNotSavedTitle'),
          text: text('idleFailedText', { minutes: saved }),
        });
        return;
      }
      queryClient.setQueryData(settingsKey(tenantId), next);
      setPicked(null);
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      setNote({
        tone: 'success',
        title: text('idleSavedTitle', { minutes: next.idleMinutes }),
        text: text('idleSavedText'),
      });
    } catch {
      setNote({
        tone: 'danger',
        title: text('idleNotSavedTitle'),
        text: text('idleNotSavedText', { minutes: saved }),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {note && (
        <Callout data-testid="settings-note" tone={note.tone} title={note.title}>
          {note.text}
        </Callout>
      )}
      <Card className="max-w-(--shifa-width-140) gap-4 p-(--shifa-card-padding)">
        <h2 className="m-0 text-heading-sm leading-heading font-semibold">
          {text('idleCardTitle')}
        </h2>
        {value === undefined && isError ? (
          <LoadFailed retry={refetch} />
        ) : value === undefined ? (
          <SkeletonGroup label={text('idleLoading')}>
            <SkeletonText lines={3} />
          </SkeletonGroup>
        ) : (
          <>
            <RadioGroup
              label={text('idleLabel')}
              hint={text('idleHint')}
              value={String(value)}
              onValueChange={(next) => {
                setPicked(Number(next) as Minutes);
                setNote(null);
              }}
            >
              {CHOICES.map((c) => (
                <Radio key={c.value} value={String(c.value)} description={text(c.use)}>
                  {text('idleOption', { minutes: c.value })}
                </Radio>
              ))}
            </RadioGroup>
            <p className="m-0 text-caption leading-body text-text-muted">
              {text('idleAdmins', { minutes: ADMIN_MINUTES })}
            </p>
            <div className="flex justify-end">
              <Button
                variant="primary"
                loading={busy}
                disabled={value === saved}
                onClick={() => void save()}
              >
                {text('save')}
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

export function SettingsPage() {
  const text = useText();
  const session = useSignedIn();
  const clinic = useActiveClinic(session);
  if (!session) return null;
  if (!isOwner(session) || session.tenantId === null) return <Navigate to="/account" replace />;
  return (
    <AppFrame
      current="settings"
      title={text('settingsTitle')}
      description={
        clinic ? text('settingsText', { clinic: clinic.name }) : text('settingsTextPlain')
      }
    >
      <IdleCard tenantId={session.tenantId} />
      <SettingsBranchesCard
        tenantId={session.tenantId}
        userId={session.userId}
        solo={clinic?.solo === true}
      />
    </AppFrame>
  );
}
