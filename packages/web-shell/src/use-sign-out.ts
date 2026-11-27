// A deliberate sign-out from any page (slice A-01-07 checkpoint 4): ends the session, forgets the
// cache, tells the other tabs and goes to sign-in with «خرجت من حسابك», or with the notice that
// the server did not answer (the session may still be open there).
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useShell } from './providers.tsx';
import { cachedSupport, signOut } from './session.ts';

export function useSignOut(): () => Promise<void> {
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useCallback(async () => {
    // A support session's «خروج» ends its grant: the ended page, never sign-in (A-02-10).
    if (cachedSupport(queryClient)) {
      await signOut(shell, queryClient);
      await navigate({ to: '/support/ended', ignoreBlocker: true });
      return;
    }
    const ended = await signOut(shell, queryClient, 'signed_out');
    await navigate({
      to: '/sign-in',
      search: { reason: ended ? 'signed_out' : 'sign_out_failed' },
    });
  }, [shell, queryClient, navigate]);
}
