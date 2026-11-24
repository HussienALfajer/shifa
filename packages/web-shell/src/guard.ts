// Where a route sends a visitor (slice A-01-06), as one pure decision the router's `beforeLoad`
// applies. Order: no session → sign-in; admin web without platformAdmin → sign out; clinic web
// with a super admin → the page naming admin web; MFA owed → /mfa; then the signed-out and MFA
// pages send a finished session home.
import type { SessionState, SessionView } from './session.ts';

export type ShellApp = 'clinic' | 'admin';

/**
 * - `signed-out`: sign-in; a session goes home.
 * - `open`: anyone (about, the setup link page).
 * - `mfa`: a session that owes MFA; any other goes home.
 * - `admin-web`: clinic web's page for a super admin.
 * - `choose`: clinic web's chooser, for a finished session (with or without a clinic).
 * - `signed-in`: everything else; on clinic web it needs a clinic, else the chooser.
 */
export type RouteKind = 'signed-out' | 'open' | 'mfa' | 'admin-web' | 'choose' | 'signed-in';

/**
 * Why sign-in was shown; `?reason=` on /sign-in. `idle`, `absolute` and `ended` are the server's
 * reason of a `session_expired` (or the page's own idle timer); `session_expired` alone when the
 * server named none.
 */
export type SignInReason =
  | 'session_expired'
  | 'idle'
  | 'absolute'
  | 'ended'
  | 'not_admin'
  | 'signed_out'
  | 'sign_out_failed'
  | (string & {});

export type GuardOutcome =
  | { action: 'stay' }
  | {
      action: 'redirect';
      to: '/' | '/sign-in' | '/mfa' | '/admin-web' | '/choose';
      reason?: SignInReason;
    }
  | { action: 'sign-out'; reason: 'not_admin' };

const STAY: GuardOutcome = { action: 'stay' };

/** The MFA step owed: enrolment where required, or the challenge of an enrolled factor. */
export function owesMfa(session: SessionView): boolean {
  return session.mfa === 'pending' || (session.mfaRequired && session.mfa !== 'verified');
}

export function decideRoute(app: ShellApp, kind: RouteKind, state: SessionState): GuardOutcome {
  if (kind === 'open') return STAY;
  if (state.kind === 'signed-out') {
    if (kind === 'signed-out') return STAY;
    // A visitor who simply has no session needs no reason; a lapsed session says why.
    return state.code === 'unauthorized'
      ? { action: 'redirect', to: '/sign-in' }
      : { action: 'redirect', to: '/sign-in', reason: state.reason ?? state.code };
  }
  const { session } = state;
  if (app === 'admin' && !session.platformAdmin) {
    // On sign-in it stays: if the sign-out failed (5xx), signing out again would loop.
    return kind === 'signed-out' ? STAY : { action: 'sign-out', reason: 'not_admin' };
  }
  if (app === 'clinic' && session.platformAdmin) {
    return kind === 'admin-web' ? STAY : { action: 'redirect', to: '/admin-web' };
  }
  if (kind === 'admin-web') return { action: 'redirect', to: '/' };
  if (owesMfa(session)) return kind === 'mfa' ? STAY : { action: 'redirect', to: '/mfa' };
  // Admin web has no chooser: a super admin works in no clinic.
  if (kind === 'choose') return app === 'clinic' ? STAY : { action: 'redirect', to: '/' };
  // Several clinics, or roles in several branches of one: the server chose none (A-01-05).
  if (app === 'clinic' && session.tenantId === null) return { action: 'redirect', to: '/choose' };
  if (kind === 'signed-out' || kind === 'mfa') return { action: 'redirect', to: '/' };
  return STAY;
}
