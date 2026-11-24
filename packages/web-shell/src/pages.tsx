// The shell's pages. Sign-in, the setup link and MFA are the approved screens of A-01-07
// (`auth/`); home, about and admin web are still the placeholders of A-01-06, which name the
// page, who is signed in and the session's state so the journeys can check the shell, until
// A-01-07's next checkpoint and A-01-08 replace them with the approved drawings.
import type { CommonKey } from '@shifa/i18n';
import { Button, Card, CardBody, SegmentedControl } from '@shifa/ui';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AccountPage } from './account/account-page.tsx';
import { AppFrame } from './account/app-frame.tsx';
import { SettingsPage } from './account/settings-page.tsx';
import { ClinicPage } from './admin/clinic-page.tsx';
import { ClinicsPage } from './admin/clinics-page.tsx';
import { CreateClinicPage } from './admin/create-clinic-page.tsx';
import { CodesLeftNotice } from './auth/codes-left-notice.tsx';
import { MfaPage } from './auth/mfa.tsx';
import { SetupLinkPage } from './auth/setup-link.tsx';
import { SignInPage } from './auth/sign-in.tsx';
import { ClinicChooserPage } from './chooser/clinic-chooser.tsx';
import { SessionEndsNotice } from './idle-dialog.tsx';
import { useShell } from './providers.tsx';
import type { ShellPages } from './router.tsx';
import { type SessionView, useSession } from './session.ts';
import { useText } from './text.ts';
import { type ThemePreference, useThemePreference } from './theme.ts';
import { useSignOut } from './use-sign-out.ts';

export { useText };

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
  const signOutNow = useSignOut();
  return (
    <Button variant="secondary" onClick={signOutNow}>
      {text('signOut')}
    </Button>
  );
}

/** Who is signed in and what the session still needs. The idle warning is the root's dialog. */
function SessionSummary({ session }: { session: SessionView }) {
  const text = useText();
  return (
    <div data-testid="signed-in" className="flex flex-col gap-2">
      <p>{text('signedInAs', { userId: session.userId })}</p>
      <p data-testid="mfa-state" data-mfa={session.mfa} data-required={String(session.mfaRequired)}>
        {text(MFA_TEXT[session.mfa])}
        {session.mfaRequired && session.mfa !== 'verified' ? ` ${text('mfaRequiredNote')}` : ''}
      </p>
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

/**
 * Clinic web's home (A-01-08 checkpoint 2): inside the frame, so the header switcher is there
 * after every switch (the router goes home). Its content is still the placeholder of A-01-06
 * until the home screen is drawn; the journeys read the session summary.
 */
function HomePage() {
  const text = useText();
  return (
    <AppFrame current="home" title={text('homeTitle')} description={text('homePending')}>
      <SessionEndsNotice />
      <CodesLeftNotice />
      <Card>
        <CardBody>
          <div className="flex flex-col gap-4 text-body">
            <CurrentSession />
            <Link to="/about">{text('aboutTitle')}</Link>
          </div>
        </CardBody>
      </Card>
    </AppFrame>
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

export const shellPages: ShellPages = {
  signIn: SignInPage,
  mfa: MfaPage,
  home: HomePage,
  about: AboutPage,
  setup: SetupLinkPage,
  choose: ClinicChooserPage,
  adminWeb: AdminWebPage,
  account: AccountPage,
  settings: SettingsPage,
  clinics: ClinicsPage,
  createClinic: CreateClinicPage,
  clinic: ClinicPage,
  notFound: NotFoundPage,
};
