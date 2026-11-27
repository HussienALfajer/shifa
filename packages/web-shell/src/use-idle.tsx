// The idle limit on the page (slice A-01-06, A-01a criterion 9), run once at the root of every
// app (IdleBoundary), so a page cannot forget it; the boundary also draws the idle dialog
// (A-01-07 checkpoint 4) and pages read the state with useIdleView() (the 12-hour notice).
// Activity is pointer, key, wheel, scroll and touch; a one-second tick; a BroadcastChannel shared
// by the app's tabs; the server's clock, not the browser's (clockOffset). At expiry it signs out
// and goes to sign-in with `reason=idle` (`absolute` when the 12-hour limit came first), unless a
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
import { IdleDialog } from './idle-dialog.tsx';
import {
  clockOffset,
  createIdleTracker,
  type IdleState,
  type IdleTracker,
  idleAction,
  type SessionExpiry,
} from './idle-timer.ts';
import { useShell } from './providers.tsx';
import {
  cachedSupport,
  fetchSession,
  type SessionState,
  type SessionView,
  sessionQueryKey,
  signOut,
  signOutCount,
  useSession,
} from './session.ts';
import { rememberSupportEnd } from './support/state.ts';
import { TAB_CHANNEL } from './tabs.ts';

const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/** The 12-hour notice shows this long before the absolute limit (improvement f). */
export const ABSOLUTE_NOTICE_MS = 10 * 60_000;

const expiryOf = (session: SessionView): SessionExpiry => ({
  idleExpiresAt: Date.parse(session.idleExpiresAt),
  absoluteExpiresAt: Date.parse(session.absoluteExpiresAt),
});

export interface IdleView {
  state: IdleState;
  /** Which limit ends the session first: only the idle one can be moved by working on. */
  cause: 'idle' | 'absolute';
  /** The idle setting that applies (minutes), for the dialog's text. */
  idleMinutes: number | undefined;
  /** The 12-hour limit (ms since the epoch) once it is ten minutes away or less. */
  absoluteEndsAt: number | undefined;
  /** «متابعة العمل»: asks the server now; rejects when the request failed. */
  continueWork: () => Promise<void>;
  /** «خروج الآن»: signs out, tells the other tabs, goes to sign-in. */
  signOutNow: () => Promise<void>;
}

const NONE: IdleView = {
  state: { kind: 'active' },
  cause: 'idle',
  idleMinutes: undefined,
  absoluteEndsAt: undefined,
  continueWork: () => Promise.resolve(),
  signOutNow: () => Promise.resolve(),
};

interface Facts {
  state: IdleState;
  cause: IdleView['cause'];
  absoluteEndsAt: number | undefined;
}

const factsOf = (tracker: IdleTracker, now: number): Facts => {
  const expiry = tracker.expiry();
  return {
    state: tracker.state(),
    cause: expiry.absoluteExpiresAt < expiry.idleExpiresAt ? 'absolute' : 'idle',
    absoluteEndsAt:
      expiry.absoluteExpiresAt - now <= ABSOLUTE_NOTICE_MS ? expiry.absoluteExpiresAt : undefined,
  };
};

export function useIdle(shell: ShellClient, session: SessionView | undefined): IdleView {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [facts, setFacts] = useState<Facts>({
    state: { kind: 'active' },
    cause: 'idle',
    absoluteEndsAt: undefined,
  });
  const live = useRef<{
    tracker: IdleTracker;
    now: () => number;
    end: () => void;
    /** A newer answer for the same session (a switch, a page's request): its limits and clock. */
    take: (session: SessionView) => void;
  } | null>(null);
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
    if (!start) {
      setFacts({ state: { kind: 'active' }, cause: 'idle', absoluteEndsAt: undefined });
      return undefined;
    }
    let offset = start.offset;
    const now = () => Date.now() + offset;
    const channel =
      typeof BroadcastChannel === 'function' ? new BroadcastChannel(TAB_CHANNEL) : undefined;
    const tracker = createIdleTracker({
      expiry: start.expiry,
      now,
      refresh: async () => {
        const asked = signOutCount();
        const next = await fetchSession(shell);
        // A sign-out started meanwhile (the press that fired this refresh): its answer is stale
        // and must not put the ended session back in the cache (review finding 2).
        if (next.kind !== 'signed-in' || signOutCount() !== asked) return null;
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
    live.current = {
      tracker,
      now,
      end: () => {
        ended = true;
      },
      take: (next) => {
        offset = clockOffset(next, Date.now());
        tracker.answer(expiryOf(next));
      },
    };
    const tick = setInterval(() => {
      // Signing out (the limit, or «خروج الآن»): nothing more to show or do.
      if (ended) return;
      tracker.tick();
      const next = factsOf(tracker, now());
      setFacts(next);
      const action = idleAction(next.state, { gone: tracker.gone(), ended });
      if (action === 'none') return;
      ended = true;
      const ran = minutes.current;
      const reason = next.cause;
      // A support session's absolute end is its grant's expiry: the ended page says so (A-02-10).
      const known = queryClient.getQueryData<SessionState>(sessionQueryKey);
      const support = known?.kind === 'signed-in' ? known.session.support : null;
      if (support && reason === 'absolute') {
        rememberSupportEnd({
          kind: 'ended',
          endedBy: 'expiry',
          endedAt: Date.parse(support.expiresAt),
          ownerName: null,
        });
        queryClient.clear();
        // One read, so the server clears the support cookie (security review L3); its 401 is
        // ignored, the cache being empty.
        void fetchSession(shell).catch(() => undefined);
        void navigate({ to: '/support/ended', ignoreBlocker: true });
        return;
      }
      // Idle in a support tab: its grant is ended, as «خروج» would, and the ended page shown.
      if (support) {
        void signOut(shell, queryClient).finally(() =>
          navigate({ to: '/support/ended', ignoreBlocker: true }),
        );
        return;
      }
      void signOut(shell, queryClient, reason).finally(() =>
        navigate({
          to: '/sign-in',
          search: reason === 'idle' && ran !== undefined ? { reason, minutes: ran } : { reason },
        }),
      );
    }, 1000);
    return () => {
      live.current = null;
      clearInterval(tick);
      for (const type of ACTIVITY) globalThis.removeEventListener(type, onActivity, listen);
      channel?.removeEventListener('message', onMessage);
      channel?.close();
    };
  }, [start, shell, queryClient, navigate]);

  // Every newer answer for this session reaches the tracker: after a switch the clinic's idle
  // setting applies at once, not from the next activity (only a later limit is taken).
  useEffect(() => {
    if (session) live.current?.take(session);
  }, [session]);

  return useMemo<IdleView>(
    () => ({
      ...facts,
      idleMinutes: session?.idleMinutes,
      continueWork: async () => {
        const current = live.current;
        if (!current) return;
        await current.tracker.extend();
        setFacts(factsOf(current.tracker, current.now()));
      },
      signOutNow: async () => {
        live.current?.end();
        // The dialog closes at once; the timer is stopped, so nothing reopens it.
        setFacts((f) => ({ ...f, state: { kind: 'active' } }));
        // A support session ends its grant and shows the ended page (A-02-10).
        if (cachedSupport(queryClient)) {
          await signOut(shell, queryClient);
          await navigate({ to: '/support/ended', ignoreBlocker: true });
          return;
        }
        const done = await signOut(shell, queryClient, 'signed_out');
        await navigate({
          to: '/sign-in',
          search: { reason: done ? 'signed_out' : 'sign_out_failed' },
        });
      },
    }),
    [facts, session?.idleMinutes, shell, queryClient, navigate],
  );
}

const IdleContext = createContext<IdleView>(NONE);

/** The idle state of the current session. */
export function useIdleState(): IdleState {
  return useContext(IdleContext).state;
}

/** The idle view: state, which limit ends first, the 12-hour notice, and the dialog's answers. */
export function useIdleView(): IdleView {
  return useContext(IdleContext);
}

/** Runs the idle limit for whatever page is inside (the router's root component). */
export function IdleBoundary({ children }: { children: ReactNode }) {
  const { shell } = useShell();
  const state = useSession(shell);
  const idle = useIdle(shell, state?.kind === 'signed-in' ? state.session : undefined);
  return (
    <IdleContext value={idle}>
      {children}
      <IdleDialog view={idle} />
    </IdleContext>
  );
}
