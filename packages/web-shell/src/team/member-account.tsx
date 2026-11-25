// The account part of the member drawer (slice A-01-08 checkpoint 3; prototype `Team08`; A-01b
// criterion 3, OD-95): TOTP on or off and its reset (an enrolled non-owner), a new link (pending:
// «إصدار رابط جديد», the earlier stops; active: «رابط لكلمة مرور جديدة», the password cleared and
// sessions ended), «إلغاء الدعوة» or «إيقاف الحساب», and «إعادة التفعيل»; each confirmed. Nothing
// on oneself (A-01-12: the server refuses `self_action` too). The last owner's deactivation is
// disabled with the reason. A refusal the confirmation cannot fix closes it and is named in the
// drawer; `last_owner` and a lost answer stay in the confirmation.
import type { CommonKey } from '@shifa/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  Badge,
  Button,
} from '@shifa/ui';
import { useId, useState } from 'react';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import type { MemberDetail, MemberLink } from './data.ts';

type Ask = 'deactivate' | 'reactivate' | 'link' | 'mfa';

export interface Note {
  tone: 'success' | 'warning' | 'danger';
  title: CommonKey;
  text: CommonKey;
}

/** Codes that close the confirmation and are named in the drawer, with a fresh read. */
const EXPLAINED: Record<string, Note> = {
  account_shared: { tone: 'warning', title: 'memberSharedTitle', text: 'memberSharedText' },
  mfa_not_enrolled: { tone: 'warning', title: 'memberMfaGoneTitle', text: 'memberMfaGoneText' },
  member_deactivated: {
    tone: 'warning',
    title: 'memberDeactivatedTitle',
    text: 'memberDeactivatedText',
  },
  member_not_deactivated: {
    tone: 'warning',
    title: 'memberNotDeactivatedTitle',
    text: 'memberNotDeactivatedText',
  },
};

export const GONE: Note = { tone: 'warning', title: 'memberGoneTitle', text: 'memberGoneText' };

export function MemberAccount({
  member,
  onDetail,
  onLink,
  onNote,
  reread,
}: {
  member: MemberDetail;
  /** The member as the server answered an action. */
  onDetail: (next: MemberDetail) => void;
  onLink: (link: MemberLink) => void;
  onNote: (note: Note | null) => void;
  reread: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [failure, setFailure] = useState('');
  const reasonId = useId();
  const path = { params: { path: { id: member.id } } };
  const owner = member.roles.some((r) => r.role === 'owner');
  const { status, name } = member;

  async function run(ask: Ask) {
    setFailure(text('memberActionUnknown'));
    onNote(null);
    let answer: { data?: unknown; error?: unknown; response: Response };
    try {
      answer =
        ask === 'link'
          ? await shell.api.POST('/team/members/{id}/setup-link', path)
          : ask === 'mfa'
            ? await shell.api.POST('/team/members/{id}/reset-mfa', path)
            : ask === 'deactivate'
              ? await shell.api.POST('/team/members/{id}/deactivate', path)
              : await shell.api.POST('/team/members/{id}/reactivate', path);
    } catch (error) {
      // A lost answer may hide an action the server did: read the member again.
      reread();
      throw error;
    }
    const { data, error, response } = answer;
    if (data) {
      if (ask === 'link') {
        onLink(data as MemberLink);
        reread();
      } else {
        onDetail(data as MemberDetail);
        if (ask === 'mfa') {
          onNote({ tone: 'success', title: 'memberResetMfaDone', text: 'memberSavedText' });
        }
      }
      return;
    }
    const { code } = errorFacts(error);
    const explained = response.status === 404 ? GONE : EXPLAINED[code];
    if (explained) {
      setAsk(null);
      onNote(explained);
      reread();
      return;
    }
    setFailure(
      code === 'last_owner'
        ? `${text('memberLastOwnerTitle')}. ${text('memberLastOwnerText')}`
        : text('serverErrorText'),
    );
    throw new Error(`member action answered ${String(response.status)}`);
  }

  const words: Record<Ask, { title: string; body: string; action: string }> = {
    deactivate:
      status === 'pending'
        ? {
            title: text('memberCancelInviteTitle', { name }),
            body: text('memberCancelInviteText'),
            action: text('memberCancelInvite'),
          }
        : {
            title: text('memberDeactivateTitle', { name }),
            body: text('memberDeactivateText'),
            action: text('memberDeactivate'),
          },
    reactivate: {
      title: text('memberReactivateTitle', { name }),
      body: text('memberReactivateText'),
      action: text('memberReactivate'),
    },
    link:
      status === 'pending'
        ? {
            title: text('memberNewLinkTitle', { name }),
            body: text('memberNewLinkPending'),
            action: text('memberLinkAction'),
          }
        : {
            title: text('memberPasswordLinkTitle', { name }),
            body: text('memberPasswordLinkText'),
            action: text('memberLinkAction'),
          },
    mfa: {
      title: text('memberResetMfaTitle', { name }),
      body: text('memberResetMfaText'),
      action: text('memberResetMfaAction'),
    },
  };
  const asked = ask === null ? null : { ask, ...words[ask] };
  const open = (next: Ask) => () => {
    setFailure('');
    setAsk(next);
  };

  return (
    <section className="flex flex-col gap-3 border-t border-border-default pt-4">
      <h3 className="m-0 text-body leading-heading font-semibold">{text('memberAccount')}</h3>
      {member.isSelf ? (
        <p className="m-0 text-data leading-body text-text-muted">{text('memberSelfNote')}</p>
      ) : (
        <>
          {status !== 'pending' && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={member.mfaEnrolled ? 'success' : 'neutral'}>
                {text(member.mfaEnrolled ? 'memberMfaOn' : 'memberMfaOff')}
              </Badge>
              {owner && (
                <span className="text-caption leading-body text-text-muted">
                  {text('memberMfaOwner')}
                </span>
              )}
            </div>
          )}
          {owner && member.isLastOwner && status !== 'deactivated' && (
            <p id={reasonId} className="m-0 text-caption leading-body text-text-muted">
              {text('memberLastOwner')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {status !== 'deactivated' && (
              <Button variant="secondary" startIcon="file-text" onClick={open('link')}>
                {text(status === 'pending' ? 'memberNewLink' : 'memberPasswordLink')}
              </Button>
            )}
            {status === 'active' && member.mfaEnrolled && !owner && (
              <Button variant="ghost" startIcon="phone" onClick={open('mfa')}>
                {text('memberResetMfa')}
              </Button>
            )}
            {status === 'deactivated' ? (
              <Button variant="secondary" startIcon="check" onClick={open('reactivate')}>
                {text('memberReactivate')}
              </Button>
            ) : (
              <Button
                variant="danger"
                startIcon="x-circle"
                disabled={member.isLastOwner}
                // Read with the button by a screen reader's browse mode (review, non-blocking 6).
                {...(member.isLastOwner ? { 'aria-describedby': reasonId } : {})}
                onClick={open('deactivate')}
              >
                {text(status === 'pending' ? 'memberCancelInvite' : 'memberDeactivate')}
              </Button>
            )}
          </div>
        </>
      )}
      <AlertDialog
        open={asked !== null}
        onOpenChange={(next) => {
          if (!next) setAsk(null);
        }}
      >
        {asked && (
          <AlertDialogContent
            tone={asked.ask === 'reactivate' ? 'info' : 'danger'}
            title={asked.title}
            description={asked.body}
          >
            <AlertDialogCancel>{text('back')}</AlertDialogCancel>
            <AlertDialogAction errorText={failure} onAction={() => run(asked.ask)}>
              {asked.action}
            </AlertDialogAction>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </section>
  );
}
