// «دخول الدعم» on the clinic page (slice A-02-08; board `A02Clinic`, states `sup` … `supSuspended`;
// A-02 criteria 11, 14): with no open grant of this super admin, the form (a reason of 10–500
// characters, 30 min, 1, 2 or 4 h) that opens clinic web in a new tab at the hand-off; with one,
// the card «دخولك مفتوح» with the time left on the server's clock (each minute), «فتح عيادة
// الويب» (a new hand-off) and «إنهاء» (asked first); the log below. A suspended clinic says so
// above the form and can still be opened.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTrigger,
  Badge,
  Button,
  Callout,
  Radio,
  RadioGroup,
  Textarea,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { clockTime } from '../auth/lock.ts';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import { type SupportGrant, supportKey, useSupportGrants } from './clinic-data.ts';
import type { ClinicDetail } from './data.ts';
import { type HandoffResult, openBlankTab, sendTab } from './support-handoff.ts';
import { SupportLog } from './support-log.tsx';
import {
  NoteCallout,
  TabCard,
  TabFailed,
  TabLoading,
  type TabNote,
  TabStack,
} from './tab-parts.tsx';

const REASON_MIN = 10;
const REASON_MAX = 500;
const DURATIONS = [
  { minutes: 30, word: 'supportMinutes30' },
  { minutes: 60, word: 'supportMinutes60' },
  { minutes: 120, word: 'supportMinutes120' },
  { minutes: 240, word: 'supportMinutes240' },
] as const;

/** The server's clock, from the `now` of the last answer (the device's clock is not trusted). */
function useServerNow(serverNow: string | undefined, readAt: number): number {
  const offset = serverNow === undefined ? 0 : Date.parse(serverNow) - readAt;
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(Date.now());
    }, 15_000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return Math.max(tick, readAt) + offset;
}

function OpenCard({
  grant,
  now,
  onHandoff,
  onEnd,
}: {
  grant: SupportGrant;
  now: number;
  onHandoff: () => void;
  onEnd: () => Promise<void>;
}) {
  const text = useText();
  const left = Math.max(0, Math.ceil((Date.parse(grant.expiresAt) - now) / 60_000));
  return (
    <TabCard
      title={
        <span className="flex flex-wrap items-center gap-2">
          {text('supportOpenTitle')}
          <Badge tone="info" icon="clock">
            {text('supportLeft', { count: left })}
          </Badge>
        </span>
      }
      text={text('supportOpenLine', {
        start: clockTime(Date.parse(grant.startedAt)),
        end: clockTime(Date.parse(grant.expiresAt)),
        reason: grant.reason,
      })}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" startIcon="share" onClick={onHandoff}>
            {text('supportOpenWeb')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger variant="secondary">{text('supportEnd')}</AlertDialogTrigger>
            <AlertDialogContent
              tone="danger"
              title={text('supportEndTitle')}
              description={text('supportEndText')}
            >
              <AlertDialogCancel>{text('back')}</AlertDialogCancel>
              <AlertDialogAction errorText={text('serverErrorText')} onAction={onEnd}>
                {text('supportEndAction')}
              </AlertDialogAction>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      }
    >
      <p className="m-0 text-caption leading-heading text-text-muted">{text('supportOwnersSee')}</p>
    </TabCard>
  );
}

export function SupportTab({ clinic }: { clinic: ClinicDetail }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const { data, isError, isPending, refetch, dataUpdatedAt } = useSupportGrants(clinic.id);
  const now = useServerNow(data?.now, dataUpdatedAt);
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [problem, setProblem] = useState<'reason' | 'active' | null>(null);
  const [note, setNote] = useState<TabNote | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const handoffNote = (result: HandoffResult): TabNote | null =>
    result === 'opened'
      ? null
      : {
          tone: 'warning',
          icon: 'warning',
          title: text('supportTabFailedTitle'),
          text: text(result === 'blocked' ? 'supportTabBlockedText' : 'supportTabFailedText'),
        };

  const failed = (tab: Window | null, offline: boolean) => {
    tab?.close();
    setNote({
      tone: 'danger',
      icon: offline ? 'wifi-slash' : 'warning',
      title: text(offline ? 'unreachableTitle' : 'actionFailedTitle'),
      text: text(offline ? 'clinicUnknownText' : 'serverErrorText'),
    });
  };

  async function open() {
    if (inFlight.current) return;
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN) {
      setProblem('reason');
      return;
    }
    const tab = openBlankTab();
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    setNote(null);
    try {
      const {
        data: opened,
        error,
        response,
      } = await shell.api.POST('/platform/clinics/{id}/support-grants', {
        params: { path: { id: clinic.id } },
        body: { reason: trimmed, minutes },
      });
      if (opened) {
        setNote(handoffNote(sendTab(tab, opened.handoffUrl)));
        setReason('');
        await refetch();
        return;
      }
      tab?.close();
      const code = (error as { error?: { code?: string } } | undefined)?.error?.code;
      if (response.status === 409 && code === 'support_active') setProblem('active');
      else if (response.status === 400) setProblem('reason');
      else failed(null, false);
    } catch {
      failed(tab, true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function handoff(grant: SupportGrant) {
    const tab = openBlankTab();
    setNote(null);
    try {
      const { data: next, response } = await shell.api.POST(
        '/platform/support-grants/{id}/handoff',
        { params: { path: { id: grant.id } } },
      );
      if (next) {
        setNote(handoffNote(sendTab(tab, next.handoffUrl)));
        return;
      }
      tab?.close();
      if (response.status === 409 || response.status === 404) {
        setNote({
          tone: 'warning',
          title: text('supportGoneTitle'),
          text: text('supportGoneText'),
        });
        await refetch();
      } else failed(null, false);
    } catch {
      failed(tab, true);
    }
  }

  async function end(grant: SupportGrant) {
    const { data: ended, response } = await shell.api.POST('/platform/support-grants/{id}/end', {
      params: { path: { id: grant.id } },
    });
    if (!ended && response.status !== 409 && response.status !== 404) {
      throw new Error('POST support end failed');
    }
    setNote(
      ended
        ? {
            tone: 'success',
            title: text('supportEndedTitle'),
            text: text('supportEndedText', {
              time: clockTime(Date.parse(ended.endedAt ?? grant.expiresAt)),
            }),
          }
        : { tone: 'warning', title: text('supportGoneTitle'), text: text('supportGoneText') },
    );
    await queryClient.invalidateQueries({ queryKey: supportKey(clinic.id) });
  }

  if (isPending) return <TabLoading label="clinicLoading" />;
  if (isError || !data) return <TabFailed retry={refetch} />;

  return (
    <TabStack>
      {clinic.status === 'suspended' && (
        <Callout tone="info" title={text('supportSuspendedTitle')}>
          {text('supportSuspendedText')}
        </Callout>
      )}
      <NoteCallout note={note} />
      {data.mine !== null ? (
        <OpenCard
          grant={data.mine}
          now={now}
          onHandoff={() => void handoff(data.mine as SupportGrant)}
          onEnd={() => end(data.mine as SupportGrant)}
        />
      ) : (
        <TabCard title={text('supportFormTitle')} text={text('supportFormText')}>
          {problem === 'active' && (
            <Callout
              tone="warning"
              title={text('supportActiveTitle')}
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setProblem(null);
                    void refetch();
                  }}
                >
                  {text('supportActiveShow')}
                </Button>
              }
            >
              {text('supportActiveText')}
            </Callout>
          )}
          <Textarea
            label={text('supportReason')}
            required
            maxLength={REASON_MAX}
            value={reason}
            onValueChange={(v) => {
              setReason(v);
              if (problem === 'reason') setProblem(null);
            }}
            hint={text('supportReasonHint')}
            error={problem === 'reason' ? text('supportReasonShort') : undefined}
          />
          <RadioGroup
            label={text('supportDuration')}
            orientation="horizontal"
            value={String(minutes)}
            onValueChange={(v) => {
              setMinutes(Number(v));
            }}
          >
            {DURATIONS.map((d) => (
              <Radio key={d.minutes} value={String(d.minutes)}>
                {text(d.word)}
              </Radio>
            ))}
          </RadioGroup>
          <div>
            <Button variant="primary" startIcon="share" loading={busy} onClick={() => void open()}>
              {text('supportOpen')}
            </Button>
          </div>
        </TabCard>
      )}
      <TabCard title={text('supportLogTitle')}>
        <SupportLog grants={data.grants} />
      </TabCard>
    </TabStack>
  );
}
