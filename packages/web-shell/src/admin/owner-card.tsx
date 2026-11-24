// The owner card of a clinic on admin web (slice A-01-10 checkpoint 3; prototype `Main`; A-01a
// criterion 13, OD-99). The owner's name, masked phone, status and, while pending, the open link's
// expiry or «انتهى الرابط». A new setup link (confirmed: for an active owner the password is
// cleared and every session ends; for a pending one the earlier link stops) shown once; reset MFA
// and end sessions for an owner with an account, each confirmed; a pending owner's phone corrected
// (PATCH …/owner) with the new link shown once. 409 `owner_account_exists` or
// `owner_setup_pending` from an action whose premise changed reads the clinic again.
import type { CommonKey } from '@shifa/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Badge,
  Button,
  Callout,
  Card,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { clockTime, dayDate } from '../auth/dates.ts';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import { type ClinicDetail, clinicKey, type SetupLink } from './data.ts';
import { LinkShown } from './link-shown.tsx';
import { PhoneDialog } from './phone-dialog.tsx';

type Ask = 'link' | 'mfa' | 'sessions' | 'phone' | null;

interface Note {
  tone: 'success' | 'warning';
  title: CommonKey;
  text: CommonKey;
}

const STATUS = {
  pending: { word: 'ownerPending', tone: 'neutral' },
  active: { word: 'ownerActive', tone: 'success' },
  deactivated: { word: 'ownerDeactivated', tone: 'warning' },
} as const satisfies Record<string, { word: CommonKey; tone: string }>;

export function OwnerCard({ clinic }: { clinic: ClinicDetail }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const [ask, setAsk] = useState<Ask>(null);
  const [link, setLink] = useState<SetupLink | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [failure, setFailure] = useState<'network' | 'server' | null>(null);
  const { owner } = clinic;
  const path = { params: { path: { id: clinic.id } } };
  const reread = () => queryClient.invalidateQueries({ queryKey: clinicKey(clinic.id) });

  const showLink = (issued: SetupLink) => {
    setLink(issued);
    setNote(null);
    void reread();
  };

  /**
   * Sends one owner action. A lost answer may hide an action the server did (the earlier link is
   * already dead): the card is read again and the words say the result is unknown (review 3).
   */
  async function attempt<T>(call: () => Promise<T>): Promise<T> {
    setFailure(null);
    try {
      return await call();
    } catch (error) {
      setFailure('network');
      void reread();
      throw error;
    }
  }

  function refusedBy(response: Response): never {
    setFailure('server');
    void reread();
    throw new Error(`owner action answered ${String(response.status)}`);
  }

  async function newLink() {
    const { data, response } = await attempt(() =>
      shell.api.POST('/platform/clinics/{id}/owner/setup-link', path),
    );
    if (!data) refusedBy(response);
    showLink(data);
  }

  async function ownerAction(kind: 'mfa' | 'sessions') {
    const { error, response } = await attempt(() =>
      kind === 'mfa'
        ? shell.api.POST('/platform/clinics/{id}/owner/reset-mfa', path)
        : shell.api.POST('/platform/clinics/{id}/owner/end-sessions', path),
    );
    if (response.status === 409 && errorFacts(error).code === 'owner_setup_pending') {
      // The owner has no account (a new link reset it meanwhile): say why nothing happened.
      setNote({ tone: 'warning', title: 'ownerNotSetUpTitle', text: 'ownerNotSetUpText' });
      await reread();
      return;
    }
    if (!response.ok) refusedBy(response);
    setNote(
      kind === 'mfa'
        ? { tone: 'success', title: 'ownerResetMfaDone', text: 'ownerResetMfaDoneText' }
        : { tone: 'success', title: 'ownerEndSessionsDone', text: 'ownerEndSessionsText' },
    );
  }

  if (owner === null) {
    return (
      <div data-testid="owner-card" className="contents">
        <Card className="gap-3 p-(--shifa-card-padding)">
          <h2 className="m-0 text-heading-sm leading-heading font-semibold">
            {text('ownerCardTitle')}
          </h2>
          <p className="m-0 text-data text-text-muted">{text('ownerNone')}</p>
        </Card>
      </div>
    );
  }

  const expires = owner.linkExpiresAt === null ? null : Date.parse(owner.linkExpiresAt);
  const status = STATUS[owner.status];
  const confirm = {
    link: {
      title: text('ownerNewLinkTitle'),
      body: text(owner.status === 'pending' ? 'ownerNewLinkPending' : 'ownerNewLinkActive'),
      action: text('ownerNewLinkAction'),
      run: newLink,
    },
    mfa: {
      title: text('ownerResetMfaTitle'),
      body: text('ownerResetMfaText'),
      action: text('ownerResetMfaAction'),
      run: () => ownerAction('mfa'),
    },
    sessions: {
      title: text('ownerEndSessionsTitle'),
      body: text('ownerEndSessionsText'),
      action: text('ownerEndSessionsAction'),
      run: () => ownerAction('sessions'),
    },
  };
  const asked = ask === 'link' || ask === 'mfa' || ask === 'sessions' ? confirm[ask] : null;
  return (
    <div data-testid="owner-card" className="contents">
      <Card className="gap-4 p-(--shifa-card-padding)">
        <div className="flex items-center gap-2">
          <h2 className="m-0 flex-1 text-heading-sm leading-heading font-semibold">
            {text('ownerCardTitle')}
          </h2>
          <Badge tone={status.tone}>{text(status.word)}</Badge>
        </div>
        <dl className="m-0 flex flex-col gap-2 text-data leading-body">
          <div className="flex gap-6">
            <dt className="w-(--shifa-width-24) shrink-0 text-text-muted">
              {text('fieldOwnerName')}
            </dt>
            <dd className="m-0 font-medium">{owner.name}</dd>
          </div>
          <div className="flex gap-6">
            <dt className="w-(--shifa-width-24) shrink-0 text-text-muted">
              {text('ownerPhoneLabel')}
            </dt>
            <dd className="m-0">
              <bdi dir="ltr" className="tabular-nums">
                {owner.phoneMasked}
              </bdi>
            </dd>
          </div>
        </dl>
        {owner.status === 'pending' && expires !== null && (
          <Callout tone={expires > Date.now() ? 'info' : 'warning'} icon="clock">
            {expires > Date.now()
              ? text('ownerLinkExpires', { date: `${dayDate(expires)} ${clockTime(expires)}` })
              : text('ownerLinkExpired')}
          </Callout>
        )}
        {note && (
          <Callout tone={note.tone} title={text(note.title)}>
            {text(note.text)}
          </Callout>
        )}
        {link && (
          <div className="flex flex-col gap-3 border-t border-border-default pt-4">
            <h3 className="m-0 text-body leading-heading font-semibold">{text('linkNewTitle')}</h3>
            {/* A replaced link starts uncopied (review A-01-10 checkpoint 3, 2). */}
            <LinkShown key={link.url} link={link} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            startIcon="file-text"
            onClick={() => {
              setAsk('link');
            }}
          >
            {text('ownerNewLink')}
          </Button>
          {owner.status === 'pending' && (
            <Button
              variant="ghost"
              startIcon="phone"
              onClick={() => {
                setAsk('phone');
              }}
            >
              {text('ownerFixPhone')}
            </Button>
          )}
          {owner.status === 'active' && (
            <>
              <Button
                variant="ghost"
                startIcon="phone"
                onClick={() => {
                  setAsk('mfa');
                }}
              >
                {text('ownerResetMfa')}
              </Button>
              <Button
                variant="ghost"
                startIcon="sign-out"
                onClick={() => {
                  setAsk('sessions');
                }}
              >
                {text('ownerEndSessions')}
              </Button>
            </>
          )}
        </div>
        <AlertDialog
          open={asked !== null}
          onOpenChange={(open) => {
            if (!open) setAsk(null);
          }}
        >
          {asked && (
            <AlertDialogContent tone="danger" title={asked.title} description={asked.body}>
              <AlertDialogCancel>{text('back')}</AlertDialogCancel>
              <AlertDialogAction
                errorText={text(failure === 'server' ? 'serverErrorText' : 'ownerActionUnknown')}
                onAction={asked.run}
              >
                {asked.action}
              </AlertDialogAction>
            </AlertDialogContent>
          )}
        </AlertDialog>
        {ask === 'phone' && (
          <PhoneDialog
            clinicId={clinic.id}
            onIssued={(issued) => {
              setAsk(null);
              showLink(issued);
            }}
            onSetUp={() => {
              setAsk(null);
              setNote({
                tone: 'warning',
                title: 'ownerAccountExistsTitle',
                text: 'ownerAccountExistsText',
              });
              void reread();
            }}
            onClose={() => {
              setAsk(null);
            }}
          />
        )}
      </Card>
    </div>
  );
}
