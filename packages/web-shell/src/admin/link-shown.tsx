// The owner's link, shown once on admin web (slice A-01-10 checkpoint 3; prototype `Main`): after
// a clinic is created, a new setup link is issued or a pending owner's phone is corrected.
// CopyField with copy and WhatsApp (the server's `whatsappUrl`, link text only) and the expiry;
// `purpose` words a setup link or an invitation; a QR code beside it for an owner who is present
// (improvement e). Leaving before a copy or a share asks first (improvement h), except for
// sign-in: a session that ended or «خروج» always leaves. The link lives in the caller's state only.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  CopyField,
  QrCode,
} from '@shifa/ui';
import { useBlocker } from '@tanstack/react-router';
import { useState } from 'react';
import { clockTime, dayDate } from '../auth/dates.ts';
import { useText } from '../text.ts';
import type { SetupLink } from './data.ts';

/**
 * A clinic member's link (clinic web, A-01-08 checkpoint 3) has no purpose, by design (OD-76): its
 * words name the person and cover both a setup link and an invitation.
 */
export interface MemberLinkShown {
  url: string;
  whatsappUrl: string;
  expiresAt: string;
  member: string;
}

export function LinkShown({
  link,
  onSent,
}: {
  link: SetupLink | MemberLinkShown;
  /** Copied or shared: the caller may stop asking before it closes (the member drawer). */
  onSent?: () => void;
}) {
  const text = useText();
  const [sent, setSent] = useState(false);
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => !sent && next.pathname !== '/sign-in',
    enableBeforeUnload: () => !sent,
    withResolver: true,
  });
  const markSent = () => {
    setSent(true);
    onSent?.();
  };
  const expires = Date.parse(link.expiresAt);
  const member = 'member' in link ? link.member : null;
  const invitation = 'purpose' in link && link.purpose === 'invitation';
  const note =
    member === null
      ? text(invitation ? 'linkInvitationNote' : 'linkSetupNote')
      : text('memberLinkNote', { name: member });
  const label =
    member === null ? text(invitation ? 'linkInvitation' : 'linkSetup') : text('memberLink');
  return (
    <div data-testid="link-shown" className="flex flex-wrap items-start gap-5">
      {/* At least 240 px: in a narrow place (the member drawer) the QR code goes below. */}
      <div className="flex min-w-(--shifa-width-60) flex-1 flex-col gap-3">
        <p className="m-0 text-data leading-body text-text-muted">{note}</p>
        <CopyField
          value={link.url}
          label={label}
          copyLabel={text('linkCopy')}
          copiedLabel={text('linkCopied')}
          refusedText={text('linkRefused')}
          share={{ href: link.whatsappUrl, label: text('linkShare') }}
          expiry={text('linkExpiry', { date: `${dayDate(expires)} ${clockTime(expires)}` })}
          onCopied={markSent}
          onShared={markSent}
        />
      </div>
      <div className="flex flex-col items-center gap-2">
        <QrCode value={link.url} label={text(member === null ? 'linkQr' : 'memberLinkQr')} />
        <p className="m-0 max-w-(--shifa-width-37-5) text-center text-caption leading-body text-text-muted">
          {text(member === null ? 'linkQrNote' : 'memberLinkQrNote')}
        </p>
      </div>
      <AlertDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        {blocker.status === 'blocked' && (
          <AlertDialogContent
            tone="danger"
            title={text('linkLeaveTitle')}
            description={text('linkLeaveText')}
          >
            <AlertDialogCancel>{text('linkLeaveStay')}</AlertDialogCancel>
            <AlertDialogAction
              onAction={() => {
                blocker.proceed();
              }}
            >
              {text('linkLeaveGo')}
            </AlertDialogAction>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
