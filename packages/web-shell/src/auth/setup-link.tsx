// The setup link (slice A-01-07 checkpoint 3), as the owner approved it on 2026-11-24 ("Shifa
// Screens · Clinic web", page "A-01-07 Sign-in batch", prototype `Main`), shared by both apps.
// The token is read from the URL fragment and removed from history at once (the router's replace,
// history.replaceState in a browser); it travels only in request bodies, never in a URL or a log.
// POST /auth/setup-link/view → the person, the clinic, the role, the masked phone (improvement h)
// and the expiry; the new password twice, its length rule ticked while typing (a); POST
// /auth/setup-link/consume → the session goes into the cache and the guard routes it (an owner or
// a super admin to enrolment, a member into the clinic). An invitation hands over to its page
// (A-01-08). 404 `link_invalid`, or a fragment that is no token, is one message with no clinic name.
import type { Schemas } from '@shifa/api-client-ts';
import type { CommonKey } from '@shifa/i18n';
import { Avatar, Button, Callout, EmptyState, Icon, PasswordInput, SkeletonText } from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { sessionQueryKey } from '../session.ts';
import { useText } from '../text.ts';
import { AuthLayout } from './auth-layout.tsx';
import { clockTime, dayDate, fromNow } from './dates.ts';
import { rememberSetupView } from './setup-view.ts';

type SetupLinkView = Schemas['SetupLinkView'];

/** The token's form (`SetupLinkToken`): 32 random bytes, base64url. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** The server's rule (A-01a criterion 8); the server still decides. */
const PASSWORD_MIN = 10;

const ROLE: Record<SetupLinkView['role'], CommonKey> = {
  owner: 'setupRoleOwner',
  doctor: 'setupRoleDoctor',
  receptionist: 'setupRoleReceptionist',
  assistant: 'setupRoleAssistant',
  accountant: 'setupRoleAccountant',
  platform_admin: 'setupRolePlatformAdmin',
};

const PASSWORD_RULE: Record<string, CommonKey> = {
  password_too_short: 'setupPasswordTooShort',
  password_common: 'setupPasswordCommon',
  password_contains_phone: 'setupPasswordContainsPhone',
};

type Shown =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'unreachable' }
  | { kind: 'view'; view: SetupLinkView };

/** The token of the fragment, once; null when there is none or it is no token. */
function useFragmentToken(): string | null {
  const router = useRouter();
  const navigate = useNavigate();
  const [token] = useState(() => {
    const hash = router.state.location.hash.replace(/^#/, '');
    return TOKEN.test(hash) ? hash : null;
  });
  useEffect(() => {
    if (router.state.location.hash === '') return;
    void navigate({ to: '/setup', hash: '', replace: true });
  }, [router, navigate]);
  return token;
}

export function SetupLinkPage() {
  const text = useText();
  const { shell } = useShell();
  const token = useFragmentToken();
  const [shown, setShown] = useState<Shown>(token ? { kind: 'loading' } : { kind: 'invalid' });
  const asked = useRef(false);

  async function load() {
    if (token === null) return;
    setShown({ kind: 'loading' });
    try {
      const { data } = await shell.api.POST('/auth/setup-link/view', { body: { token } });
      setShown(data ? { kind: 'view', view: data } : { kind: 'invalid' });
    } catch {
      setShown({ kind: 'unreachable' });
    }
  }

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void load();
  });

  return (
    <AuthLayout>
      {shown.kind === 'loading' && (
        <div className="flex flex-col gap-5" role="status" aria-label={text('setupLoading')}>
          <SkeletonText lines={3} />
          <SkeletonText lines={2} />
        </div>
      )}
      {shown.kind === 'invalid' && <InvalidLink />}
      {shown.kind === 'unreachable' && (
        <Callout
          tone="danger"
          icon="wifi-slash"
          title={text('unreachableTitle')}
          action={
            <Button size="sm" variant="secondary" onClick={load}>
              {text('retry')}
            </Button>
          }
        >
          {text('unreachableText')}
        </Callout>
      )}
      {shown.kind === 'view' && token !== null && shown.view.purpose === 'invitation' && (
        <Invitation view={shown.view} />
      )}
      {shown.kind === 'view' && token !== null && shown.view.purpose !== 'invitation' && (
        <SetPassword
          view={shown.view}
          token={token}
          onInvalid={() => {
            setShown({ kind: 'invalid' });
          }}
        />
      )}
    </AuthLayout>
  );
}

function InvalidLink() {
  const text = useText();
  const navigate = useNavigate();
  return (
    <>
      <EmptyState
        icon="x-circle"
        size="page"
        headingLevel={2}
        title={text('setupInvalidTitle')}
        description={text('setupInvalidText')}
      />
      <Button variant="secondary" onClick={() => navigate({ to: '/sign-in' })}>
        {text('setupToSignIn')}
      </Button>
    </>
  );
}

/** An invitation is answered on its own page (A-01-08, OD-91); this link only names it. */
function Invitation({ view }: { view: SetupLinkView }) {
  const text = useText();
  return (
    <div className="flex flex-col gap-2">
      <h1 className="m-0 text-heading-md leading-heading font-semibold">
        {text('invitationTitle', { clinic: view.clinicName ?? '' })}
      </h1>
      <p className="m-0 text-body leading-body text-text-muted">{text('invitationText')}</p>
    </div>
  );
}

function SetPassword({
  view,
  token,
  onInvalid,
}: {
  view: SetupLinkView;
  token: string;
  onInvalid: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [problem, setProblem] = useState<
    | null
    | { field: 'password'; key: CommonKey }
    | { field: 'repeat'; key: CommonKey }
    | { field: 'page'; kind: 'pending' | 'network' | 'server' }
  >(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const admin = view.purpose === 'admin_setup';
  const enrols = admin || view.purpose === 'owner_setup';
  const expires = Date.parse(view.expiresAt);

  async function send() {
    if (inFlight.current) return;
    if (password === '') {
      setProblem({ field: 'password', key: 'setupPasswordEmpty' });
      return;
    }
    if (password !== repeat) {
      setProblem({ field: 'repeat', key: 'setupMismatch' });
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const { data, error } = await shell.api.POST('/auth/setup-link/consume', {
        body: { token, password },
      });
      if (data) {
        rememberSetupView(queryClient, {
          personName: view.personName,
          clinicName: view.clinicName,
        });
        queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: data });
        await navigate({ to: '/' });
        return;
      }
      const { code } = errorFacts(error);
      const rule = PASSWORD_RULE[code];
      if (rule) setProblem({ field: 'password', key: rule });
      else if (code === 'link_invalid') onInvalid();
      else if (code === 'owner_setup_pending') setProblem({ field: 'page', kind: 'pending' });
      else setProblem({ field: 'page', kind: 'server' });
    } catch {
      setProblem({ field: 'page', kind: 'network' });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  const lengthMet = password.length >= PASSWORD_MIN;
  const page = problem?.field === 'page' ? problem.kind : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-heading-md leading-heading font-semibold">
          {admin
            ? text('setupTitleAdmin')
            : text('setupTitleClinic', { clinic: view.clinicName ?? '' })}
        </h1>
        <p className="m-0 text-body leading-body text-text-muted">
          {text('setupValidity', {
            date: dayDate(expires),
            time: clockTime(expires),
            relative: fromNow(expires),
          })}
        </p>
      </div>
      <div className="flex items-center gap-3 rounded-surface border border-border-default bg-bg-surface px-4 py-3">
        <Avatar name={view.personName} size="md" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-data leading-body font-medium">{view.personName}</span>
          <span className="text-data leading-body text-text-muted">{text(ROLE[view.role])}</span>
        </div>
      </div>
      {!admin && (
        <p className="m-0 text-data leading-body text-text-muted">
          {text('setupPhone', { phone: '⁦' + view.phoneMasked + '⁩' })}
        </p>
      )}
      {page === 'pending' && (
        <Callout tone="warning" title={text('setupOwnerPendingTitle')}>
          {text('setupOwnerPendingText')}
        </Callout>
      )}
      {(page === 'network' || page === 'server') && (
        <Callout
          tone="danger"
          icon={page === 'network' ? 'wifi-slash' : 'warning'}
          title={text(page === 'network' ? 'unreachableTitle' : 'serverErrorTitle')}
          action={
            <Button size="sm" variant="secondary" loading={busy} onClick={send}>
              {text('retry')}
            </Button>
          }
        >
          {text(page === 'network' ? 'unreachableText' : 'serverErrorText')}
        </Callout>
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <PasswordInput
            label={text('setupNewPassword')}
            autoComplete="new-password"
            value={password}
            onValueChange={(value) => {
              setPassword(value);
              if (problem?.field === 'password') setProblem(null);
            }}
            error={
              problem?.field === 'password' ? text(problem.key, { min: PASSWORD_MIN }) : undefined
            }
          />
          <div className="flex flex-col gap-1" aria-live="polite">
            <span
              data-rule="length"
              data-met={String(lengthMet)}
              className={
                lengthMet
                  ? 'flex items-center gap-2 text-data leading-body text-status-success-fg'
                  : 'flex items-center gap-2 text-data leading-body text-text-muted'
              }
            >
              <Icon name={lengthMet ? 'check-circle' : 'minus'} />
              {text('setupRuleLength', { min: PASSWORD_MIN, count: password.length })}
            </span>
            <span className="flex items-center gap-2 text-data leading-body text-text-muted">
              <Icon name="info" />
              {text('setupRuleOther')}
            </span>
          </div>
        </div>
        <PasswordInput
          label={text('setupRepeatPassword')}
          autoComplete="new-password"
          value={repeat}
          onValueChange={(value) => {
            setRepeat(value);
            if (problem?.field === 'repeat') setProblem(null);
          }}
          error={problem?.field === 'repeat' ? text(problem.key) : undefined}
        />
        <Button variant="primary" size="lg" type="submit" loading={busy}>
          {text(enrols ? 'setupSaveEnrol' : 'setupSaveEnter')}
        </Button>
      </form>
    </>
  );
}
