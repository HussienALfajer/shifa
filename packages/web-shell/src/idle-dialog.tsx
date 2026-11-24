// The idle warning and the 12-hour notice (slice A-01-07 checkpoint 4; prototype `Main`,
// approved 2026-11-24). The dialog opens one minute before the idle limit over every page
// (IdleBoundary draws it): «هل ما زلت تعمل؟», the minutes without activity, a countdown from
// 01:00, why it closes; «خروج الآن» and «متابعة العمل» (the session re-read). It never opens
// for the 12-hour limit, which working on cannot move: that one has the quiet notice ten minutes
// before (improvement f), drawn by the pages.
import { AlertDialog, AlertDialogAction, AlertDialogContent, Button, Callout } from '@shifa/ui';
import { clockTime } from './auth/lock.ts';
import { useText } from './text.ts';
import type { IdleView } from './use-idle.tsx';
import { useIdleView } from './use-idle.tsx';

/** The length of a session before the absolute limit, for the notice's words (A-01-02). */
const SESSION_HOURS = 12;

const pad = (n: number) => String(n).padStart(2, '0');

/** `01:00`, `00:59`: minutes and seconds, Western digits. */
export function countdown(seconds: number): string {
  const total = Math.max(0, seconds);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function IdleDialog({ view }: { view: IdleView }) {
  const text = useText();
  const { state, cause } = view;
  const open = state.kind === 'warning' && cause === 'idle';
  const seconds = state.kind === 'warning' ? state.secondsLeft : 60;
  const quiet = Math.max(0, (view.idleMinutes ?? 1) - 1);
  return (
    <AlertDialog open={open}>
      {open && (
        <AlertDialogContent
          tone="info"
          title={text('idleTitle')}
          description={
            <>
              <span className="block">{text('idleText', { count: quiet })}</span>
              {/* Ticking digits are not read out; the end time is, once. */}
              <span
                aria-hidden="true"
                dir="ltr"
                data-testid="idle-countdown"
                className="my-2 block text-center text-display leading-heading font-semibold text-text-default tabular-nums"
              >
                {countdown(seconds)}
              </span>
              <span className="sr-only">
                {text('idleEndsAt', { time: clockTime(Date.now() + seconds * 1000) })}
              </span>
              <span className="block">{text('idleSafety')}</span>
            </>
          }
        >
          <Button variant="secondary" startIcon="sign-out" onClick={view.signOutNow}>
            {text('idleSignOutNow')}
          </Button>
          <AlertDialogAction
            variant="primary"
            onAction={view.continueWork}
            errorText={text('idleContinueFailed')}
          >
            {text('idleContinue')}
          </AlertDialogAction>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}

/** Ten minutes or less before the 12-hour limit: when the session ends (improvement f). */
export function SessionEndsNotice() {
  const text = useText();
  const { absoluteEndsAt } = useIdleView();
  if (absoluteEndsAt === undefined) return null;
  return (
    <Callout
      data-testid="session-ends"
      tone="info"
      icon="clock"
      title={text('sessionEndsTitle', { time: clockTime(absoluteEndsAt) })}
    >
      {text('sessionEndsText', { hours: SESSION_HOURS })}
    </Callout>
  );
}
