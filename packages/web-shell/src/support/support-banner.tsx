// The support session's strip above every page of clinic web (slice A-02-10; board
// `A02cSupportSession` `session`; contract rows "Support session · banner" and "end from the
// tab"): the solid `support` PageBanner, «دخول الدعم · للقراءة فقط», the clinic, the reason and the
// time left, and «إنهاء» (asked first) → POST /auth/support/end → «انتهى دخول الدعم» (`endedSelf`).
// Never paged or hidden. Also the read-only pieces every page uses: `useReadOnly()`, the note
// under a disabled write button, and the Callout of a refused write (403 `support_read_only`).
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Button,
  Callout,
  Icon,
  PageBanner,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useSignedIn } from '../account/data.ts';
import { isSupport } from '../guard.ts';
import { useShell } from '../providers.tsx';
import { type SessionView, sessionQueryKey } from '../session.ts';
import { useText } from '../text.ts';
import { rememberSupportEnd } from './state.ts';
import { useTimeLeft } from './time-left.ts';

/** True in a support session: every write is drawn disabled with «للقراءة فقط». */
export function useReadOnly(): boolean {
  return isSupport(useSignedIn());
}

/** «للقراءة فقط» under a write button a support session cannot press. */
export function ReadOnlyNote() {
  const text = useText();
  return (
    <span className="inline-flex items-center gap-1 text-caption leading-body text-text-muted">
      <Icon name="eye" />
      {text('readOnly')}
    </span>
  );
}

/** The Callout of a write the server refused with 403 `support_read_only`, once per page. */
export function ReadOnlyRefused() {
  const text = useText();
  const { shell } = useShell();
  const [refused, setRefused] = useState(false);
  useEffect(
    () =>
      shell.onReadOnly(() => {
        setRefused(true);
      }),
    [shell],
  );
  if (!refused) return null;
  return (
    <Callout data-testid="read-only-refused" tone="danger" title={text('readOnly')}>
      {text('readOnlyRefusedText')}
    </Callout>
  );
}

export function SupportSessionBanner({ session }: { session: SessionView }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState('');
  const support = session.support;
  const receivedAt = queryClient.getQueryState(sessionQueryKey)?.dataUpdatedAt ?? Date.now();
  const left = useTimeLeft(
    support?.expiresAt ?? new Date().toISOString(),
    support?.now ?? new Date().toISOString(),
    receivedAt,
  );
  if (!support) return null;

  async function end() {
    setFailure('');
    const { response } = await shell.api.POST('/auth/support/end');
    // 401: it had already ended; the client's rule shows the ended page with the cause.
    if (response.status === 401) return;
    if (!response.ok) {
      setFailure(text('serverErrorText'));
      throw new Error(`POST /auth/support/end answered ${String(response.status)}`);
    }
    rememberSupportEnd({ kind: 'self', endedAt: Date.now() });
    queryClient.clear();
    await navigate({ to: '/support/ended', ignoreBlocker: true });
  }

  return (
    <>
      <PageBanner
        tone="support"
        icon="eye"
        title={text('supportSessionTitle')}
        aria-label={text('supportRegion')}
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setAsking(true);
            }}
          >
            {text('supportEndShort')}
          </Button>
        }
      >
        {text('supportSessionText', {
          clinic: support.clinicName,
          reason: support.reason,
          time: left.until,
          minutes: left.minutes,
        })}
      </PageBanner>
      <AlertDialog open={asking} onOpenChange={setAsking}>
        {asking && (
          <AlertDialogContent
            tone="danger"
            title={text('supportEndAskTitle')}
            description={text('supportEndAskSelf')}
          >
            <AlertDialogCancel>{text('back')}</AlertDialogCancel>
            <AlertDialogAction errorText={failure} onAction={end}>
              {text('supportEndAction')}
            </AlertDialogAction>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}
