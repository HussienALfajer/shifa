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
import type { ShellClient } from './client.ts';
import { decideRoute, type RouteKind, type ShellApp } from './guard.ts';
import { type SessionState, sessionQuery, sessionQueryKey, signOut } from './session.ts';
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
  const children = [
    signIn,
    route('/mfa', 'mfa', pages.mfa),
    route('/', 'signed-in', pages.home),
    route('/about', 'open', pages.about),
  ];
  if (app === 'clinic') {
    if (pages.setup) children.push(route('/setup', 'open', pages.setup));
    if (pages.adminWeb) children.push(route('/admin-web', 'admin-web', pages.adminWeb));
  }
  return root.addChildren(children);
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
  // Mid-session only: a 401 for a visitor who never had a session is the guard's business.
  const offEnded = shell.onSessionEnded((code, reason) => {
    const known = queryClient.getQueryData<SessionState>(sessionQueryKey);
    if (known?.kind !== 'signed-in') return;
    queryClient.clear();
    void router.navigate({ to: '/sign-in', search: searchFor(reason ?? code) });
  });
  // Another person, session or clinic behind the same page (a switch or a sign-in in another
  // tab): nothing cached for the previous one may stay on screen (security review M1).
  const SESSION_HASH = hashKey(sessionQueryKey);
  let identity: string | undefined;
  const offCache = queryClient.getQueryCache().subscribe((event) => {
    if (event.query.queryHash !== SESSION_HASH) return;
    if (event.type === 'removed') {
      identity = undefined;
      return;
    }
    if (event.type !== 'updated') return;
    const state = event.query.state.data as SessionState | undefined;
    if (state?.kind !== 'signed-in') return;
    const { userId, sessionId, tenantId } = state.session;
    const next = `${userId}|${sessionId}|${tenantId ?? ''}`;
    const changed = identity !== undefined && identity !== next;
    identity = next;
    if (!changed) return;
    queryClient.removeQueries({ predicate: (q) => q.queryHash !== SESSION_HASH });
    void router.navigate({ to: '/' });
  });
  const dispose = () => {
    offEnded();
    offCache();
  };
  return { router, dispose };
}

export type ShellRouter = ReturnType<typeof createShellRouter>['router'];
