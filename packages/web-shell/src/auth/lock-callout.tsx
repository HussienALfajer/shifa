// The warning of a lock (slice A-01-07, improvement b), as on sign-in and the MFA screens of the
// approved prototype `Main`: a title, the reason, the countdown to the server's `until` and its
// clock time. The ticking m:ss is for the eyes; screen readers hear the end time once (the alert
// re-reads a changed region, so the countdown would be announced each second).
import { Callout } from '@shifa/ui';
import { useText } from '../text.ts';
import { clockTime, type Lock, remaining } from './lock.ts';

export function LockCallout({
  lock,
  now,
  title,
  text: reason,
}: {
  lock: Lock;
  now: number;
  title: string;
  text: string;
}) {
  const text = useText();
  return (
    <Callout data-testid="lock" data-code={lock.code} tone="warning" icon="clock" title={title}>
      {reason}{' '}
      <span aria-hidden="true" className="tabular-nums">
        {text('lockWait', { wait: remaining(lock.endsAt - now), time: clockTime(lock.until) })}
      </span>
      <span className="sr-only">{text('lockWaitAt', { time: clockTime(lock.until) })}</span>
    </Callout>
  );
}
