// Public surface of @shifa/web-shell (slice A-01-06). The Vite side is `@shifa/web-shell/vite`.
export { createShellClient, type ShellClient, type ShellClientOptions } from './client.ts';
export {
  decideRoute,
  type GuardOutcome,
  owesMfa,
  type RouteKind,
  type ShellApp,
  type SignInReason,
} from './guard.ts';
export {
  clockOffset,
  createIdleTracker,
  type IdleMessage,
  type IdleState,
  type IdleTracker,
  idleAction,
  idleState,
  isIdleMessage,
  REFRESH_EVERY_MS,
  type SessionExpiry,
  WARNING_MS,
} from './idle-timer.ts';
export { type MountOptions, mountShellApp } from './mount.tsx';
export { ICON_CREDIT, shellPages, useText } from './pages.tsx';
export { type ShellContextValue, ShellProviders, useShell } from './providers.tsx';
export {
  buildRouteTree,
  createShellRouter,
  type ShellPages,
  type ShellRouter,
  type SignInSearch,
} from './router.tsx';
export {
  fetchSession,
  type SessionState,
  type SessionView,
  sessionQuery,
  sessionQueryKey,
  signOut,
  useSession,
  watchFocus,
} from './session.ts';
export { type ThemePreference, useThemePreference } from './theme.ts';
export { IdleBoundary, type IdleView, useIdle, useIdleState, useIdleView } from './use-idle.tsx';
export { useSignOut } from './use-sign-out.ts';
