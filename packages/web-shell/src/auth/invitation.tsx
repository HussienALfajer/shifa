// Answering an invitation on its link (slice A-01-08 checkpoint 2), as the owner approved it on
// 2026-11-24 ("Shifa Screens · Clinic web", page "A-01-08 Team batch", prototype `Team08`, the
// invitation page; OD-91, OD-104). The link is a setup link of purpose `invitation`; the setup
// page hands its token here. POST /invitations/view names the clinic, the person as the owner
// typed them, the roles with their branch, the expiry and the invited phone masked (gap 6).
// Signed out (or owing the second factor): «الدخول للرد على الدعوة» holds the token in memory and
// goes home, where the guard asks for sign-in; the router brings the finished session back here.
// Signed in: accept → «انضممت إلى …» and «فتح العيادة» (POST /me/switch to it), or decline,
// confirmed first. 403 `invitation_other_phone`: the invited number's last digits and «خروج»
// (the token held again, so the right person comes back to it). 404 `link_invalid`: one message
// without the clinic's name. No connection: «لم يُسجَّل جوابك», the page kept for a retry.
import type { Schemas } from '@shifa/api-client-ts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Badge,
  Button,
  Callout,
  EmptyState,
  SkeletonText,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ROLE_TEXT } from '../chooser/chooser-text.ts';
import { useClinicSwitch } from '../chooser/use-clinic-switch.ts';
import { errorFacts } from '../client.ts';
import { owesMfa } from '../guard.ts';
import { useShell } from '../providers.tsx';
import { useSession } from '../session.ts';
import { useText } from '../text.ts';
import { useSignOut } from '../use-sign-out.ts';
import { clockTime, dayDate } from './dates.ts';
import { holdInvitation } from './held-invitation.ts';

type InvitationView = Schemas['InvitationView'];

type Shown =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'unreachable' }
  | { kind: 'server' }
  | { kind: 'view'; view: InvitationView }
  | { kind: 'accepted'; view: InvitationView }
  | { kind: 'declined'; view: InvitationView };

type Failure = 'other' | 'network' | 'server' | undefined;

/** The invited number's last digits, from its masked form («+963 ••• ••• 876» → 876). */
const lastDigits = (masked: string) => masked.replace(/\D/g, '').slice(-3);

export function InvalidInvitation() {
  const text = useText();
  return (
    <EmptyState
      icon="x-circle"
      size="page"
      headingLevel={2}
      title={text('setupInvalidTitle')}
      description={text('inviteInvalidText')}
    />
  );
}

export function InvitationAnswer({ token }: { token: string }) {
  const text = useText();
  const { shell } = useShell();
  const state = useSession(shell);
  const signedIn = state?.kind === 'signed-in' && !owesMfa(state.session);
  const navigate = useNavigate();
  const signOut = useSignOut();
  const queryClient = useQueryClient();
  const [shown, setShown] = useState<Shown>({ kind: 'loading' });
  const [failure, setFailure] = useState<Failure>();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const asked = useRef(false);
  const open = useClinicSwitch({
    reload: () => undefined,
    askBranch: () => void navigate({ to: '/choose' }),
    backToClinics: () => undefined,
  });

  async function load() {
    setShown({ kind: 'loading' });
    try {
      const { data, error } = await shell.api.POST('/invitations/view', { body: { token } });
      if (data) setShown({ kind: 'view', view: data });
      else if (errorFacts(error).code === 'link_invalid') setShown({ kind: 'invalid' });
      else setShown({ kind: 'server' });
    } catch {
      setShown({ kind: 'unreachable' });
    }
  }

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void load();
  });

  /** Sends the answer; true when the server recorded it. */
  async function answer(
    path: '/invitations/accept' | '/invitations/decline',
    view: InvitationView,
  ) {
    setFailure(undefined);
    try {
      const { error, response } = await shell.api.POST(path, { body: { token } });
      if (response.ok) {
        setShown({ kind: path === '/invitations/accept' ? 'accepted' : 'declined', view });
        return true;
      }
      const { code } = errorFacts(error);
      if (code === 'invitation_other_phone') setFailure('other');
      else if (code === 'link_invalid' || response.status === 404) setShown({ kind: 'invalid' });
      else setFailure('server');
      return true;
    } catch {
      setFailure('network');
      return false;
    }
  }

  async function openClinic(view: InvitationView) {
    const { data } = await shell.api.GET('/me/clinics').catch(() => ({ data: undefined }));
    // The accept answers 204 without the clinic's id: the clinic is found by its name among the
    // person's clinics (a backlog gap); not exactly one, the shell's own routing decides.
    const matches = data?.clinics.filter((c) => c.name === view.clinicName && c.selectable) ?? [];
    const [only] = matches;
    if (matches.length === 1 && only) {
      open.choose(only.tenantId, null);
      return;
    }
    await queryClient.invalidateQueries();
    await navigate({ to: '/' });
  }

  if (shown.kind === 'loading') {
    return (
      <div className="flex flex-col gap-5" role="status" aria-label={text('inviteLoading')}>
        <SkeletonText lines={3} />
        <SkeletonText lines={2} />
      </div>
    );
  }
  if (shown.kind === 'invalid') return <InvalidInvitation />;
  if (shown.kind === 'unreachable' || shown.kind === 'server') {
    return (
      <Callout
        tone="danger"
        icon={shown.kind === 'unreachable' ? 'wifi-slash' : 'warning'}
        title={text(shown.kind === 'unreachable' ? 'unreachableTitle' : 'serverErrorTitle')}
        action={
          <Button size="sm" variant="secondary" onClick={load}>
            {text('retry')}
          </Button>
        }
      >
        {text(shown.kind === 'unreachable' ? 'unreachableText' : 'serverErrorText')}
      </Callout>
    );
  }

  const { view } = shown;
  const roles = view.roles.map((r) =>
    r.branchName === null
      ? text(ROLE_TEXT[r.role])
      : `${text(ROLE_TEXT[r.role])} · ${r.branchName}`,
  );

  if (shown.kind === 'accepted') {
    return (
      <div className="flex flex-col items-center gap-4">
        <EmptyState
          art="jasmine"
          size="page"
          headingLevel={2}
          title={text('inviteAcceptedTitle', { clinic: view.clinicName })}
          description={text('inviteAcceptedText', { roles: roles.join(' و') })}
        />
        <Button variant="primary" loading={open.busy} onClick={() => void openClinic(view)}>
          {text('inviteOpen')}
        </Button>
      </div>
    );
  }
  if (shown.kind === 'declined') {
    return (
      <div className="flex flex-col items-center gap-4">
        <EmptyState
          icon="check-circle"
          size="page"
          headingLevel={2}
          title={text('inviteDeclinedTitle')}
          description={text('inviteDeclinedText')}
        />
        <Button variant="secondary" onClick={() => navigate({ to: '/' })}>
          {text('inviteToClinics')}
        </Button>
      </div>
    );
  }

  const expires = Date.parse(view.expiresAt);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="m-0 text-caption leading-body font-medium text-text-muted">
          {text('inviteKicker')}
        </p>
        <h1 className="m-0 text-heading-md leading-heading font-semibold">{view.clinicName}</h1>
        <p className="m-0 text-body leading-body">{text('inviteAs', { name: view.personName })}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <Badge key={r} tone="outline" size="md" icon={false}>
            {r}
          </Badge>
        ))}
      </div>
      <p className="m-0 text-data leading-body text-text-muted tabular-nums">
        {text('inviteValid', { date: dayDate(expires), time: clockTime(expires) })}
      </p>
      <p className="m-0 text-data leading-body">
        {text('inviteForPhone')}{' '}
        <bdi dir="ltr" className="tabular-nums">
          {view.phoneMasked}
        </bdi>
      </p>
      {failure === 'other' && (
        <Callout
          tone="warning"
          title={text('inviteOtherTitle')}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                holdInvitation(token);
                void signOut();
              }}
            >
              {text('signOutShort')}
            </Button>
          }
        >
          {text('inviteOtherText', { last: lastDigits(view.phoneMasked) })}
        </Callout>
      )}
      {(failure === 'network' || failure === 'server') && (
        <Callout
          tone="danger"
          {...(failure === 'network' ? { icon: 'wifi-slash' as const } : {})}
          title={text(failure === 'network' ? 'switchNetworkTitle' : 'serverErrorTitle')}
        >
          {text(failure === 'network' ? 'inviteNetworkText' : 'serverErrorText')}
        </Callout>
      )}
      {signedIn ? (
        <>
          <p className="m-0 text-data leading-body">{text('inviteAfter')}</p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setAsking(true);
              }}
            >
              {text('inviteDecline')}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await answer('/invitations/accept', view);
                setBusy(false);
              }}
            >
              {text('inviteAccept')}
            </Button>
          </div>
          <AlertDialog open={asking} onOpenChange={setAsking}>
            <AlertDialogContent
              tone="danger"
              title={text('inviteDeclineTitle', { clinic: view.clinicName })}
              description={text('inviteDeclineText')}
            >
              <AlertDialogCancel>{text('inviteKeep')}</AlertDialogCancel>
              <AlertDialogAction
                errorText={text('inviteNetworkText')}
                onAction={async () => {
                  const recorded = await answer('/invitations/decline', view);
                  // No connection: the dialog stays open with its error, for a retry.
                  if (!recorded) throw new Error('decline not recorded');
                }}
              >
                {text('inviteDeclineConfirm')}
              </AlertDialogAction>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <>
          <p className="m-0 text-data leading-body">{text('inviteSignedOutText')}</p>
          <Button
            variant="primary"
            endIcon="arrow-forward"
            onClick={() => {
              holdInvitation(token);
              void navigate({ to: '/' });
            }}
          >
            {text('inviteSignIn')}
          </Button>
        </>
      )}
    </div>
  );
}
