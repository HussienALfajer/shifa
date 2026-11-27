// «إعدادات العيادة» (slice A-01-10 checkpoint 2; prototype `Account10`; A-01a criterion 9, PLT-48;
// slice A-02-10, board `A02cSettings`), the clinic's owner only. «الخروج التلقائي»: GET and PATCH
// /clinic/settings, 15, 30 or 60 minutes, each with its use; «حفظ» waits for a change (improvement
// c). Saved: the session is read again so this tab's idle timer takes the new limit. A-02-04's
// cascade: the line under the choices says where the value comes from (`source`); `locked` → the
// choices disabled, Badge «مقفل من الإدارة», the Callout and no «حفظ»; 409 `setting_locked` (a
// lock set meanwhile) reads again. Beside it «الاشتراك», under them «سجل دخول الدعم», then the
// branches. A member has no navigation item; the address takes them to My account. In a support
// session the page is read as the owner sees it, «حفظ» disabled with «للقراءة فقط».
import type { CommonKey } from '@shifa/i18n';
import {
  Badge,
  Button,
  Callout,
  Card,
  Radio,
  RadioGroup,
  SkeletonGroup,
  SkeletonText,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { SettingsBranchesCard } from '../branches/settings-branches.tsx';
import { errorFacts } from '../client.ts';
import { useClinicFacts } from '../clinic-facts.ts';
import { useShell } from '../providers.tsx';
import { sessionQueryKey } from '../session.ts';
import { OwnerSupportLog } from '../support/owner-support.tsx';
import { ReadOnlyNote, useReadOnly } from '../support/support-banner.tsx';
import { useText } from '../text.ts';
import type { Note } from './account-page.tsx';
import { AppFrame } from './app-frame.tsx';
import { isOwner, settingsKey, useClinicSettings, useSignedIn } from './data.ts';
import { LoadFailed } from './load-failed.tsx';
import { SubscriptionCard } from './subscription-card.tsx';

type Minutes = 15 | 30 | 60;
const CHOICES = [
  { value: 15, use: 'idleUse15' },
  { value: 30, use: 'idleUse30' },
  { value: 60, use: 'idleUse60' },
] as const;
/** Super admins' fixed idle limit (A-01a criterion 9). */
const ADMIN_MINUTES = 15;

/** Where an unlocked value comes from, in words (none for an answer without a source). */
const SOURCE_WORD: Record<string, CommonKey> = {
  organization: 'idleSourceClinic',
  default: 'idleSourceDefault',
  platform: 'idleSourcePlatform',
  plan: 'idleSourcePlan',
};

function IdleCard({ tenantId }: { tenantId: string }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const readOnly = useReadOnly();
  const { data, isError, refetch } = useClinicSettings(tenantId, true);
  const [picked, setPicked] = useState<Minutes | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const saved = data?.idleMinutes;
  const locked = (data as { locked?: unknown } | undefined)?.locked === true;
  const source = (data as { source?: unknown } | undefined)?.source;
  const value = locked ? saved : (picked ?? saved);
  const sourceWord = typeof source === 'string' ? SOURCE_WORD[source] : undefined;

  async function save() {
    if (value === undefined || saved === undefined || value === saved) return;
    setBusy(true);
    setNote(null);
    try {
      const { data: next, error } = await shell.api.PATCH('/clinic/settings', {
        body: { idleMinutes: value },
      });
      if (!next) {
        if (errorFacts(error).code === 'setting_locked') {
          // Locked meanwhile: the locked state, from a fresh read.
          setPicked(null);
          await queryClient.invalidateQueries({ queryKey: settingsKey(tenantId) });
          setNote({
            tone: 'warning',
            title: text('idleNotSavedTitle'),
            text: text('idleLockedMeanwhile'),
          });
          return;
        }
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
    <div className="flex flex-col gap-4">
      {note && (
        <Callout data-testid="settings-note" tone={note.tone} title={note.title}>
          {note.text}
        </Callout>
      )}
      <Card className="gap-4 p-(--shifa-card-padding)">
        <div className="flex items-center gap-2">
          <h2 className="m-0 flex-1 text-heading-sm leading-heading font-semibold">
            {text('idleCardTitle')}
          </h2>
          {locked && (
            <Badge tone="warning" icon="clock">
              {text('idleLockedBadge')}
            </Badge>
          )}
        </div>
        {value === undefined && isError ? (
          <LoadFailed retry={refetch} />
        ) : value === undefined ? (
          <SkeletonGroup label={text('idleLoading')}>
            <SkeletonText lines={3} />
          </SkeletonGroup>
        ) : (
          <>
            {locked && <Callout tone="info">{text('idleLockedText', { minutes: value })}</Callout>}
            <RadioGroup
              label={text('idleLabel')}
              {...(locked ? {} : { hint: text('idleHint') })}
              value={String(value)}
              disabled={locked}
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
            {locked ? (
              <p className="m-0 text-caption leading-body text-text-muted">
                {text('idleSourceLocked')}
              </p>
            ) : (
              sourceWord && (
                <p className="m-0 text-caption leading-body text-text-muted">
                  {text(sourceWord, { minutes: saved ?? value })}
                </p>
              )
            )}
            <p className="m-0 text-caption leading-body text-text-muted">
              {text('idleAdmins', { minutes: ADMIN_MINUTES })}
            </p>
            {!locked && (
              <div className="flex flex-col items-end gap-1">
                <Button
                  variant="primary"
                  loading={busy}
                  disabled={readOnly || value === saved}
                  onClick={() => void save()}
                >
                  {text('save')}
                </Button>
                {readOnly && <ReadOnlyNote />}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

export function SettingsPage() {
  const text = useText();
  const session = useSignedIn();
  const clinic = useClinicFacts(session);
  if (!session) return null;
  if (!isOwner(session) || session.tenantId === null) return <Navigate to="/account" replace />;
  return (
    <AppFrame
      current="settings"
      title={text('settingsTitle')}
      description={
        clinic.name === undefined
          ? text('settingsTextPlain')
          : text('settingsText', { clinic: clinic.name })
      }
    >
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <IdleCard tenantId={session.tenantId} />
        <SubscriptionCard tenantId={session.tenantId} />
      </div>
      <OwnerSupportLog session={session} />
      <SettingsBranchesCard
        tenantId={session.tenantId}
        userId={session.userId}
        solo={clinic.known && clinic.solo}
      />
    </AppFrame>
  );
}
