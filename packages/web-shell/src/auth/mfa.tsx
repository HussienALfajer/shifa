// /mfa (slice A-01-07 checkpoint 3): the challenge when the session has an enrolled factor to
// pass (`mfa: pending`), enrolment when it has none and must enrol (`mfaRequired`). The guard
// sends a session here only while it owes the second factor. When the session becomes verified
// the screen that did it stays (enrolment still shows the recovery codes); a session verified
// elsewhere (another tab) goes on.
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
  if (session?.mfa === 'pending') mode.current = 'challenge';
  else if (session?.mfa === 'none') mode.current = 'enrol';

  // Verified while the challenge (or nothing yet) was shown: passed elsewhere, go on.
  const passedElsewhere = session?.mfa === 'verified' && mode.current !== 'enrol';
  useEffect(() => {
    if (passedElsewhere) void navigate({ to: '/' });
  }, [passedElsewhere, navigate]);

  if (session === null || mode.current === null) return null;
  return mode.current === 'challenge' ? (
    <MfaChallenge session={session} />
  ) : (
    <MfaEnrol session={session} />
  );
}
