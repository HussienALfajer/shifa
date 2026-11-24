// Placeholder pages (slice A-01-06): no product screen is drawn or coded here. Each names the
// page, who is signed in and the session's state, so the journeys can check the shell; A-01-07
// (clinic web) and A-01-08 (admin web) replace them with the approved drawings.
import type { CommonKey } from '@shifa/i18n';
import { Button, Card, CardBody, SegmentedControl } from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useShell } from './providers.tsx';
import type { ShellPages } from './router.tsx';
import { type SessionView, signOut, useSession } from './session.ts';
import { type ThemePreference, useThemePreference } from './theme.ts';
import { useIdleState } from './use-idle.tsx';

/** The shell's texts, typed by the keys of `common`. */
export function useText(): (key: CommonKey, values?: Record<string, unknown>) => string {
  const { t } = useTranslation('common');
  return (key, values) => t(key, values ?? {});
}

const REASONS: Partial<Record<string, CommonKey>> = {
  session_expired: 'reasonSessionExpired',
  idle: 'reasonIdle',
  sign_out_failed: 'reasonSignOutFailed',
  not_admin: 'reasonNotAdmin',
};

const MFA_TEXT: Record<SessionView['mfa'], CommonKey> = {
  none: 'mfaStateNone',
  pending: 'mfaStatePending',
  verified: 'mfaStateVerified',
};

/** Icon credit (OD-65: Solar by 480 Design, CC BY 4.0). Names, not words: not translated. */
export const ICON_CREDIT = {
  iconSet: 'Solar',
  author: '480 Design',
  licence: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
} as const;

function Page({ title, children }: { title: CommonKey; children: ReactNode }) {
  const text = useText();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-heading-lg">{text(title)}</h1>
      <Card>
        <CardBody>
          <div className="flex flex-col gap-4 text-body">{children}</div>
        </CardBody>
      </Card>
      <ThemeChoice />
    </main>
  );
}

function ThemeChoice() {
  const text = useText();
  const { preference, setPreference } = useThemePreference();
  return (
    <SegmentedControl
      aria-label={text('theme')}
      value={preference}
      onValueChange={(next) => {
        setPreference(next as ThemePreference);
      }}
      items={[
        { value: 'light', label: text('themeLight') },
        { value: 'dark', label: text('themeDark') },
        { value: 'system', label: text('themeSystem') },
      ]}
    />
  );
}

function SignOutButton() {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        // Always back to sign-in; say so when the server did not end the session.
        const ended = await signOut(shell, queryClient);
        await navigate({ to: '/sign-in', search: ended ? {} : { reason: 'sign_out_failed' } });
      }}
    >
      {text('signOut')}
    </Button>
  );
}

/** Who is signed in and what the session still needs. */
function SessionSummary({ session }: { session: SessionView }) {
  const text = useText();
  const idle = useIdleState();
  return (
    <div data-testid="signed-in" className="flex flex-col gap-2">
      <p>{text('signedInAs', { userId: session.userId })}</p>
      <p data-testid="mfa-state" data-mfa={session.mfa} data-required={String(session.mfaRequired)}>
        {text(MFA_TEXT[session.mfa])}
        {session.mfaRequired && session.mfa !== 'verified' ? ` ${text('mfaRequiredNote')}` : ''}
      </p>
      {idle.kind === 'warning' ? (
        <p data-testid="idle-warning" role="status" className="text-text-muted">
          {text('idleWarning', { count: idle.secondsLeft })}
        </p>
      ) : null}
      <div>
        <SignOutButton />
      </div>
    </div>
  );
}

function CurrentSession() {
  const { shell } = useShell();
  const state = useSession(shell);
  return state?.kind === 'signed-in' ? <SessionSummary session={state.session} /> : null;
}

function SignInPage() {
  const text = useText();
  const search: Record<string, unknown> = useSearch({ strict: false });
  const reason = typeof search['reason'] === 'string' ? search['reason'] : undefined;
  const key = reason ? (REASONS[reason] ?? 'reasonSignedOut') : undefined;
  return (
    <Page title="signInTitle">
      {key ? (
        <p data-testid="sign-in-reason" data-reason={reason} role="status">
          {text(key)}
        </p>
      ) : null}
      <p className="text-text-muted">{text('signInPending')}</p>
      <Link to="/about">{text('aboutTitle')}</Link>
    </Page>
  );
}

function MfaPage() {
  const text = useText();
  return (
    <Page title="mfaTitle">
      <p className="text-text-muted">{text('mfaPending')}</p>
      <CurrentSession />
    </Page>
  );
}

function HomePage() {
  const text = useText();
  return (
    <Page title="homeTitle">
      <p className="text-text-muted">{text('homePending')}</p>
      <CurrentSession />
      <Link to="/about">{text('aboutTitle')}</Link>
    </Page>
  );
}

function AboutPage() {
  const text = useText();
  const { version } = useShell();
  return (
    <Page title="aboutTitle">
      <p>{text('appName')}</p>
      <p data-testid="app-version">{text('aboutVersion', { version })}</p>
      <p data-testid="icon-credit">
        {text('aboutIcons', ICON_CREDIT)}{' '}
        <a href={ICON_CREDIT.licenceUrl} rel="noreferrer noopener" target="_blank">
          {text('aboutLicence')}
        </a>
      </p>
      <CurrentSession />
    </Page>
  );
}

/** The setup link page keeps the token in the fragment and sends it nowhere yet (A-01-07). */
function SetupPage() {
  const text = useText();
  return (
    <Page title="setupTitle">
      <p className="text-text-muted">{text('setupPending')}</p>
    </Page>
  );
}

function AdminWebPage() {
  const text = useText();
  return (
    <Page title="adminWebTitle">
      <p>{text('adminWebBody')}</p>
      <CurrentSession />
    </Page>
  );
}

function NotFoundPage() {
  const text = useText();
  return (
    <Page title="notFound">
      <Link to="/">{text('homeTitle')}</Link>
    </Page>
  );
}

export const placeholderPages: ShellPages = {
  signIn: SignInPage,
  mfa: MfaPage,
  home: HomePage,
  about: AboutPage,
  setup: SetupPage,
  adminWeb: AdminWebPage,
  notFound: NotFoundPage,
};
