// «أجهزتي» on My account (slice A-01-10 checkpoint 2; prototype `Account10`; A-01a criterion 10).
// GET /auth/sessions: device · browser («جهاز غير معروف» without them), when it signed in and its
// last activity; «هذا الجهاز» marked, without an end button. DELETE /auth/sessions/:id after a
// confirmation naming the device (404: it had already signed out, the list is read again); POST
// /auth/sessions/end-others after one with the count. Improvement d: no «إخراج كل الأجهزة
// الأخرى» without another device. A failed request keeps the confirmation open and says so.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Badge,
  Button,
  Card,
  SkeletonGroup,
  SkeletonText,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { clockTime, dayDate } from '../auth/dates.ts';
import { lastActive } from '../chooser/chooser-text.ts';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import type { Tell } from './account-page.tsx';
import { type SessionSummary, sessionsKey, useSessions, useSignedIn } from './data.ts';

const DAY = 86_400_000;
const startOfDay = (at: number) => new Date(at).setHours(0, 0, 0, 0);

type Ask = { kind: 'one'; session: SessionSummary } | { kind: 'others'; count: number } | null;

export function DevicesCard({ tell }: { tell: Tell }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const session = useSignedIn();
  const userId = session?.userId ?? '';
  const { data: sessions } = useSessions(userId);
  const [ask, setAsk] = useState<Ask>(null);
  const others = (sessions ?? []).filter((s) => !s.current);
  const now = Date.now();

  const name = (s: SessionSummary) =>
    s.device === null ? text('devicesUnknown') : [s.device, s.browser].filter(Boolean).join(' · ');

  function since(at: number): string {
    const today = startOfDay(now);
    if (at >= today) return text('devicesSinceToday', { time: clockTime(at) });
    if (at >= today - DAY) return text('devicesSinceYesterday', { time: clockTime(at) });
    return text('devicesSinceOn', { date: dayDate(at), time: clockTime(at) });
  }

  function active(s: SessionSummary): string {
    if (s.current) return text('devicesActiveNow');
    const phrase = lastActive(Date.parse(s.lastActiveAt), now);
    return text(phrase.key, phrase.values);
  }

  const reload = () => queryClient.invalidateQueries({ queryKey: sessionsKey(userId) });

  /** Throws on no answer, so the confirmation stays open with its message. */
  async function endOne(target: SessionSummary) {
    const { response } = await shell.api.DELETE('/auth/sessions/{id}', {
      params: { path: { id: target.id } },
    });
    if (!response.ok && response.status !== 404) throw new Error('not ended');
    await reload();
    tell(
      response.status === 404
        ? {
            tone: 'info',
            title: text('devicesEndOneGoneTitle'),
            text: text('devicesEndOneGoneText'),
          }
        : {
            tone: 'success',
            title: text('devicesEndOneDoneTitle'),
            text: text('devicesEndOneDoneText'),
          },
    );
  }

  async function endOthers() {
    const { data } = await shell.api.POST('/auth/sessions/end-others');
    if (!data) throw new Error('not ended');
    await reload();
    tell({
      tone: 'success',
      title: text('devicesEndOthersDoneTitle', { count: data.ended }),
      text: text('devicesEndOthersDoneText'),
    });
  }

  return (
    <Card className="gap-4 p-(--shifa-card-padding) md:col-span-3">
      <div className="flex items-center gap-2">
        <h2 className="m-0 flex-1 text-heading-sm leading-heading font-semibold">
          {text('devicesTitle')}
        </h2>
        {others.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            startIcon="sign-out"
            onClick={() => {
              tell(null);
              setAsk({ kind: 'others', count: others.length });
            }}
          >
            {text('devicesEndOthers')}
          </Button>
        )}
      </div>
      {!sessions ? (
        <SkeletonGroup label={text('devicesLoading')}>
          <SkeletonText lines={3} />
        </SkeletonGroup>
      ) : (
        <>
          <div>
            {sessions.map((s) => (
              <div
                key={s.id}
                data-testid="session-row"
                className="flex min-h-(--shifa-size-row) items-center gap-3 border-b border-border-default py-2"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-body font-medium">{name(s)}</span>
                  <span className="text-data text-text-muted tabular-nums">
                    {`${since(Date.parse(s.createdAt))} · ${active(s)}`}
                  </span>
                </span>
                {s.current ? (
                  <Badge tone="brand">{text('devicesThis')}</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    startIcon="sign-out"
                    onClick={() => {
                      tell(null);
                      setAsk({ kind: 'one', session: s });
                    }}
                  >
                    {text('devicesEnd')}
                  </Button>
                )}
              </div>
            ))}
          </div>
          {others.length === 0 && (
            <p className="m-0 text-data leading-body text-text-muted">{text('devicesNoOther')}</p>
          )}
          <p className="m-0 text-caption leading-body text-text-muted">{text('devicesHint')}</p>
        </>
      )}
      <AlertDialog
        open={ask !== null}
        onOpenChange={(open) => {
          if (!open) setAsk(null);
        }}
      >
        {ask !== null && (
          <AlertDialogContent
            tone="danger"
            title={
              ask.kind === 'one'
                ? text('devicesEndOneTitle', { device: name(ask.session) })
                : text('devicesEndOthersTitle', { count: ask.count })
            }
            description={text(ask.kind === 'one' ? 'devicesEndOneText' : 'devicesEndOthersText')}
          >
            <AlertDialogCancel>{text('back')}</AlertDialogCancel>
            <AlertDialogAction
              errorText={text('devicesEndFailed')}
              onAction={() => (ask.kind === 'one' ? endOne(ask.session) : endOthers())}
            >
              {text(ask.kind === 'one' ? 'devicesEndOneAction' : 'devicesEndOthersAction')}
            </AlertDialogAction>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </Card>
  );
}
