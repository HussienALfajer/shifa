// Wires the idle tracker to the page (slice A-01-06): pointer and key activity, a one-second tick,
// a BroadcastChannel shared by the app's tabs; at expiry it signs out and goes to sign-in with
// `reason=idle`. A-01-07 draws the warning from the state this returns.
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import type { ShellClient } from './client.ts';
import { createIdleTracker, type IdleState, type SessionExpiry } from './idle-timer.ts';
import { fetchSession, type SessionView, sessionQueryKey, signOut } from './session.ts';

const CHANNEL = 'shifa-session';
const ACTIVITY = ['pointerdown', 'keydown'] as const;

const expiryOf = (session: SessionView): SessionExpiry => ({
  idleExpiresAt: Date.parse(session.idleExpiresAt),
  absoluteExpiresAt: Date.parse(session.absoluteExpiresAt),
});

export function useIdle(shell: ShellClient, session: SessionView | undefined): IdleState {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [state, setState] = useState<IdleState>({ kind: 'active' });
  // One tracker per session: later refreshes reach it through `refresh`, not a new tracker.
  const sessionId = session?.sessionId;
  const startExpiry = useMemo(
    () => (session ? expiryOf(session) : undefined),
    // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the session's id only
    [sessionId],
  );

  useEffect(() => {
    if (!startExpiry) return undefined;
    const channel =
      typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : undefined;
    const tracker = createIdleTracker({
      expiry: startExpiry,
      now: () => Date.now(),
      refresh: async () => {
        const next = await fetchSession(shell);
        if (next.kind !== 'signed-in') return null;
        queryClient.setQueryData(sessionQueryKey, next);
        return expiryOf(next.session);
      },
      post: (message) => channel?.postMessage(message),
    });
    const onMessage = (event: MessageEvent<unknown>) => {
      tracker.receive(event.data);
    };
    channel?.addEventListener('message', onMessage);
    const onActivity = () => {
      tracker.activity();
    };
    for (const type of ACTIVITY) globalThis.addEventListener(type, onActivity, { passive: true });
    let ended = false;
    const tick = setInterval(() => {
      const next = tracker.state();
      setState(next);
      if (next.kind === 'expired' && !ended) {
        ended = true;
        void signOut(shell, queryClient).finally(() =>
          navigate({ to: '/sign-in', search: { reason: 'idle' } }),
        );
      }
    }, 1000);
    return () => {
      clearInterval(tick);
      for (const type of ACTIVITY) globalThis.removeEventListener(type, onActivity);
      channel?.removeEventListener('message', onMessage);
      channel?.close();
    };
  }, [startExpiry, shell, queryClient, navigate]);

  return state;
}
