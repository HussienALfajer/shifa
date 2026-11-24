// /mfa (slice A-01-07 checkpoint 3): the challenge when the session has an enrolled factor to
// pass (`mfa: pending`), enrolment when it has none and must enrol (`mfaRequired`). The guard
// sends a session here only while it owes the second factor. When the session becomes verified
// the screen that did it stays (enrolment still shows the recovery codes); a session verified
// elsewhere (another tab) goes on: here for the challenge, in `MfaEnrol` for enrolment.
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useShell } from '../providers.tsx';
import { useSession } from '../session.ts';
import { MfaChallenge } from './mfa-challenge.tsx';
import { MfaEnrol } from './mfa-enrol.tsx';

export function MfaPage() {
  const { shell } = useShell();
  const navigate = useNavigate();
  const state = useSession(shell);
  const session = state?.kind === 'signed-in' ? state.session : null;
  const mode = useRef<'enrol' | 'challenge' | null>(null);
  const person = useRef<string | null>(null);
  if (session && session.userId !== person.current) {
    person.current = session.userId;
    mode.current = null;
  }
  if (session?.mfa === 'pending') mode.current = 'challenge';
  else if (session?.mfa === 'none') mode.current = 'enrol';

  // Verified while the challenge (or nothing yet) was shown: passed elsewhere, go on.
  const passedElsewhere = session?.mfa === 'verified' && mode.current !== 'enrol';
  useEffect(() => {
    if (passedElsewhere) void navigate({ to: '/' });
  }, [passedElsewhere, navigate]);

  if (session === null || mode.current === null) return null;
  // Keyed by the person: if the browser's session becomes someone else's (another tab), nothing
  // of the previous person's enrolment (key, codes) stays mounted (security review L1).
  return mode.current === 'challenge' ? (
    <MfaChallenge key={session.userId} session={session} />
  ) : (
    <MfaEnrol key={session.userId} session={session} />
  );
}
