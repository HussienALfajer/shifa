// The idle limit on the page (slice A-01-06, A-01a criterion 9), run once at the root of every
// app (IdleBoundary), so a page cannot forget it; pages read the state with useIdleState() to
// draw the warning (A-01-07). Activity is pointer, key, wheel, scroll and touch; a one-second
// tick; a BroadcastChannel shared by the app's tabs; the server's clock, not the browser's
// (clockOffset). At expiry it signs out and goes to sign-in with `reason=idle`, unless a
// refresh already found the session gone: then the 401 rule names the real reason.
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ShellClient } from './client.ts';
import {
  clockOffset,
  createIdleTracker,
  type IdleState,
  idleAction,
  type SessionExpiry,
} from './idle-timer.ts';
import { useShell } from './providers.tsx';
import { fetchSession, type SessionView, sessionQueryKey, signOut, useSession } from './session.ts';

const CHANNEL = 'shifa-session';
const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

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
  // Read at sign-out only: a new idle setting (a switch, the owner's change) must not re-create
  // the tracker from the session's first expiry (security review L4).
  const minutes = useRef(session?.idleMinutes);
  minutes.current = session?.idleMinutes;
  const start = useMemo(
    () =>
      session ? { expiry: expiryOf(session), offset: clockOffset(session, Date.now()) } : undefined,
    // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the session's id only
    [sessionId],
  );

  useEffect(() => {
    if (!start) return undefined;
    let offset = start.offset;
    const channel =
      typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : undefined;
    const tracker = createIdleTracker({
      expiry: start.expiry,
      now: () => Date.now() + offset,
      refresh: async () => {
        const next = await fetchSession(shell);
        if (next.kind !== 'signed-in') return null;
        offset = clockOffset(next.session, Date.now());
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
    const listen = { passive: true, capture: true } as const;
    for (const type of ACTIVITY) globalThis.addEventListener(type, onActivity, listen);
    let ended = false;
    const tick = setInterval(() => {
      tracker.tick();
      const next = tracker.state();
      setState(next);
      const action = idleAction(next, { gone: tracker.gone(), ended });
      if (action === 'none') return;
      ended = true;
      const ran = minutes.current;
      void signOut(shell, queryClient).finally(() =>
        navigate({
          to: '/sign-in',
          search: ran === undefined ? { reason: 'idle' } : { reason: 'idle', minutes: ran },
        }),
      );
    }, 1000);
    return () => {
      clearInterval(tick);
      for (const type of ACTIVITY) globalThis.removeEventListener(type, onActivity, listen);
      channel?.removeEventListener('message', onMessage);
      channel?.close();
    };
  }, [start, shell, queryClient, navigate]);

  return state;
}

const IdleContext = createContext<IdleState>({ kind: 'active' });

/** The idle state of the current session, for the warning (A-01-07 draws it). */
export function useIdleState(): IdleState {
  return useContext(IdleContext);
}

/** Runs the idle limit for whatever page is inside (the router's root component). */
export function IdleBoundary({ children }: { children: ReactNode }) {
  const { shell } = useShell();
  const state = useSession(shell);
  const idle = useIdle(shell, state?.kind === 'signed-in' ? state.session : undefined);
  return <IdleContext value={idle}>{children}</IdleContext>;
}
