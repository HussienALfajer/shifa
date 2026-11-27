// The shell's router (slice A-01-06): the same few routes in both apps, each guarded by
// decideRoute() in `beforeLoad`, and the mid-session rule: a 401 while a session was known clears
// every cached query and goes to sign-in with the reason. Pages are placeholders until A-01-07.
import { hashKey, type QueryClient } from '@tanstack/react-query';
import {
  createBrowserHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
  redirect,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { forgetHeldInvitation, hasHeldInvitation } from './auth/held-invitation.ts';
import type { ShellClient } from './client.ts';
import { decideRoute, owesMfa, type RouteKind, type ShellApp } from './guard.ts';
import {
  fetchSession,
  type SessionState,
  sessionQuery,
  sessionQueryKey,
  signOut,
  signOutCount,
  takeOwnRotation,
} from './session.ts';
import { onOtherTabSignOut } from './tabs.ts';
import { IdleBoundary } from './use-idle.tsx';

export type { ShellApp } from './guard.ts';

/** A page: a function component without props (the router's route component). */
type ComponentType = () => ReactNode;

export interface ShellPages {
  signIn: ComponentType;
  mfa: ComponentType;
  home: ComponentType;
  about: ComponentType;
  /** Clinic web only: the setup link page and the page naming admin web. */
  setup?: ComponentType;
  adminWeb?: ComponentType;
  /** Clinic web only: the clinic chooser with its branch step (A-01-07 checkpoint 4). */
  choose?: ComponentType;
  /** Clinic web only: My account and the clinic's settings (A-01-10 checkpoint 2). */
  account?: ComponentType;
  settings?: ComponentType;
  /** Clinic web only: the owner's team (A-01-08 checkpoint 3); `?branch=` from a branch card. */
  team?: ComponentType;
  /** Clinic web only: the owner's branches (A-01-08 checkpoint 4). */
  branches?: ComponentType;
  /** Admin web only: the clinics list (its home), «إنشاء عيادة» and a clinic (A-01-10 checkpoint 3). */
  clinics?: ComponentType;
  createClinic?: ComponentType;
  clinic?: ComponentType;
  /** Admin web only: flags, announcements, cities and areas (A-02-09). */
  flags?: ComponentType;
  announcements?: ComponentType;
  places?: ComponentType;
  notFound?: ComponentType;
}

export interface ShellRouterContext {
  app: ShellApp;
  shell: ShellClient;
  queryClient: QueryClient;
}

export interface SignInSearch {
  reason?: string;
  /** With `reason=idle` from the page's own timer: the idle limit it ran, for the notice. */
  minutes?: number;
}

const signInSearch = (search: Record<string, unknown>): SignInSearch => {
  const reason = search['reason'];
  if (typeof reason !== 'string' || reason === '') return {};
  const minutes = Number(search['minutes']);
  return reason === 'idle' && Number.isInteger(minutes) && minutes > 0 && minutes <= 1440
    ? { reason, minutes }
    : { reason };
};

export interface TeamSearch {
  /** A branch's id: the team of that branch only (improvement e). */
  branch?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const teamSearch = (search: Record<string, unknown>): TeamSearch => {
  const branch = search['branch'];
  return typeof branch === 'string' && UUID.test(branch) ? { branch } : {};
};

const searchFor = (reason: string | undefined): SignInSearch =>
  reason === undefined || reason === 'unauthorized' ? {} : { reason };

/** The session, asked again whenever the last answer was "signed out". */
async function loadSession({ shell, queryClient }: ShellRouterContext): Promise<SessionState> {
  // The cached answer when there is one (staleTime 'static': never refetched here), else a fetch.
  const state = await queryClient.query({ ...sessionQuery(shell), staleTime: 'static' });
  if (state.kind === 'signed-out') queryClient.removeQueries({ queryKey: sessionQueryKey });
  return state;
}

function guard(kind: RouteKind) {
  return async ({ context }: { context: ShellRouterContext }) => {
    if (kind === 'open') return;
    const outcome = decideRoute(context.app, kind, await loadSession(context));
    // Signed in to answer an invitation (A-01-08): a finished session on clinic web goes back to
    // the invitation, whose token waits in memory (auth/held-invitation.ts).
    const finished =
      outcome.action === 'stay' || (outcome.action === 'redirect' && outcome.to === '/choose');
    if (
      context.app === 'clinic' &&
      (kind === 'signed-in' || kind === 'choose') &&
      finished &&
      hasHeldInvitation()
    ) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's redirect
      throw redirect({ to: '/setup' });
    }
    // A session sent elsewhere (a super admin to admin web, a refused session signed out) will
    // never answer it: the next person on this tab must not be shown it.
    if (
      outcome.action === 'sign-out' ||
      (outcome.action === 'redirect' && outcome.to === '/admin-web')
    ) {
      forgetHeldInvitation();
    }
    if (outcome.action === 'stay') return;
    if (outcome.action === 'sign-out') {
      await signOut(context.shell, context.queryClient);
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's redirect
      throw redirect({ to: '/sign-in', search: { reason: outcome.reason } });
    }
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's redirect
    throw redirect(
      outcome.to === '/sign-in'
        ? { to: '/sign-in', search: searchFor(outcome.reason) }
        : { to: outcome.to },
    );
  };
}

export function buildRouteTree(app: ShellApp, pages: ShellPages) {
  const root = createRootRouteWithContext<ShellRouterContext>()({
    // The idle limit runs here, once for every page (security review L1).
    component: () => (
      <IdleBoundary>
        <Outlet />
      </IdleBoundary>
    ),
    ...(pages.notFound ? { notFoundComponent: pages.notFound } : {}),
  });
  const route = (path: string, kind: RouteKind, component: ComponentType) =>
    createRoute({ getParentRoute: () => root, path, beforeLoad: guard(kind), component });
  const signIn = createRoute({
    getParentRoute: () => root,
    path: '/sign-in',
    validateSearch: signInSearch,
    beforeLoad: guard('signed-out'),
    component: pages.signIn,
  });
  const team =
    app === 'clinic' && pages.team
      ? [
          createRoute({
            getParentRoute: () => root,
            path: '/team',
            validateSearch: teamSearch,
            beforeLoad: guard('signed-in'),
            component: pages.team,
          }),
        ]
      : [];
  const children = [
    signIn,
    ...team,
    route('/mfa', 'mfa', pages.mfa),
    route('/', 'signed-in', app === 'admin' && pages.clinics ? pages.clinics : pages.home),
    route('/about', 'open', pages.about),
  ];
  // The setup link page serves both apps (a super admin's link opens on admin web).
  if (pages.setup) children.push(route('/setup', 'open', pages.setup));
  if (app === 'clinic' && pages.adminWeb) {
    children.push(route('/admin-web', 'admin-web', pages.adminWeb));
  }
  if (app === 'clinic' && pages.choose) children.push(route('/choose', 'choose', pages.choose));
  if (app === 'clinic' && pages.account) {
    children.push(route('/account', 'signed-in', pages.account));
  }
  if (app === 'clinic' && pages.settings) {
    children.push(route('/settings', 'signed-in', pages.settings));
  }
  if (app === 'clinic' && pages.branches) {
    children.push(route('/branches', 'signed-in', pages.branches));
  }
  if (app === 'admin' && pages.createClinic) {
    children.push(route('/clinics/new', 'signed-in', pages.createClinic));
  }
  if (app === 'admin' && pages.clinic) {
    children.push(route('/clinics/$id', 'signed-in', pages.clinic));
  }
  if (app === 'admin') {
    if (pages.flags) children.push(route('/flags', 'signed-in', pages.flags));
    if (pages.announcements) {
      children.push(route('/announcements', 'signed-in', pages.announcements));
    }
    if (pages.places) children.push(route('/places', 'signed-in', pages.places));
  }
  return root.addChildren(children);
}

/**
 * A new session id for the same person and clinic, from a session that still owed the second
 * factor to one that passed it: the cookie rotated by enrol/confirm or the challenge.
 */
function isMfaRotation(
  previous: SessionState | undefined,
  next: Extract<SessionState, { kind: 'signed-in' }>,
): boolean {
  if (previous?.kind !== 'signed-in') return false;
  const a = previous.session;
  const b = next.session;
  // Before the second factor no clinic route answers, so nothing cached belongs to a clinic: a
  // session that had none may name one now.
  const sameClinic = a.tenantId === b.tenantId || a.tenantId === null;
  // `owesMfa`, not "not verified": a staff session without TOTP is complete and reads clinic
  // routes; its successor gets no exception (security review L3).
  return a.userId === b.userId && sameClinic && owesMfa(a) && b.mfa === 'verified';
}

/**
 * A rotation this tab asked for (a change of password, a TOTP enrolment from My account): the
 * same person, clinic and branch, from the session id it named (`expectOwnRotation`).
 */
function isOwnRotation(
  previous: SessionState | undefined,
  next: Extract<SessionState, { kind: 'signed-in' }>,
): boolean {
  if (previous?.kind !== 'signed-in') return false;
  const a = previous.session;
  const b = next.session;
  if (a.userId !== b.userId || a.tenantId !== b.tenantId || a.branchId !== b.branchId) {
    return false;
  }
  return takeOwnRotation(a.sessionId);
}

export interface ShellRouterOptions extends ShellRouterContext {
  pages: ShellPages;
  history?: RouterHistory;
}

export function createShellRouter({ app, shell, queryClient, pages, history }: ShellRouterOptions) {
  const router = createRouter({
    routeTree: buildRouteTree(app, pages),
    context: { app, shell, queryClient },
    history: history ?? createBrowserHistory(),
    defaultPreload: false,
    // A single-page app, never rendered on a server: redirects always navigate.
    isServer: false,
  });
  // Another tab signed out: while this tab asks the server, a 401 names that tab's reason.
  let otherTab: string | undefined;
  // Mid-session only: a 401 for a visitor who never had a session is the guard's business.
  const offEnded = shell.onSessionEnded((code, reason) => {
    const known = queryClient.getQueryData<SessionState>(sessionQueryKey);
    if (known?.kind !== 'signed-in') return;
    queryClient.clear();
    void router.navigate({
      to: '/sign-in',
      search: searchFor(reason ?? otherTab ?? code),
      ignoreBlocker: true,
    });
  });
  // Never on the message alone: the server's answer decides (tabs.ts).
  const offTabs = onOtherTabSignOut((tabReason) => {
    const known = queryClient.getQueryData<SessionState>(sessionQueryKey);
    if (known?.kind !== 'signed-in') return;
    otherTab = tabReason;
    const asked = signOutCount();
    void fetchSession(shell)
      .then((state) => {
        if (state.kind === 'signed-in' && signOutCount() === asked) {
          queryClient.setQueryData(sessionQueryKey, state);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        otherTab = undefined;
      });
  });
  // Another person, session or clinic behind the same page (a switch or a sign-in in another
  // tab): nothing cached for the previous one may stay on screen (security review M1).
  const SESSION_HASH = hashKey(sessionQueryKey);
  let identity: string | undefined;
  let before: SessionState | undefined;
  const offCache = queryClient.getQueryCache().subscribe((event) => {
    if (event.query.queryHash !== SESSION_HASH) return;
    if (event.type === 'removed') {
      identity = undefined;
      before = undefined;
      return;
    }
    if (event.type !== 'updated') return;
    const state = event.query.state.data as SessionState | undefined;
    if (state?.kind !== 'signed-in') return;
    // The branch too: a switch to another branch of the same clinic keeps nothing cached for the
    // previous one (A-01-07 checkpoint 4 review finding 1).
    const { userId, sessionId, tenantId, branchId } = state.session;
    const next = `${userId}|${sessionId}|${tenantId ?? ''}|${branchId ?? ''}`;
    const changed = identity !== undefined && identity !== next;
    const rotated = changed && (isMfaRotation(before, state) || isOwnRotation(before, state));
    identity = next;
    before = state;
    // The rotation after the second factor is the same person in the same clinic: what is cached
    // stays theirs, and the MFA page shows the recovery codes before it goes on (A-01-07).
    if (!changed || rotated) return;
    queryClient.removeQueries({ predicate: (q) => q.queryHash !== SESSION_HASH });
    // Never held by a page's leave guard (admin web's one-time link): nothing of the previous
    // session may stay on screen (A-01-10 checkpoint 3 review, 8).
    void router.navigate({ to: '/', ignoreBlocker: true });
  });
  const dispose = () => {
    offEnded();
    offTabs();
    offCache();
  };
  return { router, dispose };
}

export type ShellRouter = ReturnType<typeof createShellRouter>['router'];
