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

export function LinkShown({ link }: { link: SetupLink }) {
  const text = useText();
  const [sent, setSent] = useState(false);
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => !sent && next.pathname !== '/sign-in',
    enableBeforeUnload: () => !sent,
    withResolver: true,
  });
  const expires = Date.parse(link.expiresAt);
  const invitation = link.purpose === 'invitation';
  return (
    <div data-testid="link-shown" className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="m-0 text-data leading-body text-text-muted">
          {text(invitation ? 'linkInvitationNote' : 'linkSetupNote')}
        </p>
        <CopyField
          value={link.url}
          label={text(invitation ? 'linkInvitation' : 'linkSetup')}
          copyLabel={text('linkCopy')}
          copiedLabel={text('linkCopied')}
          refusedText={text('linkRefused')}
          share={{ href: link.whatsappUrl, label: text('linkShare') }}
          expiry={text('linkExpiry', { date: `${dayDate(expires)} ${clockTime(expires)}` })}
          onCopied={() => {
            setSent(true);
          }}
          onShared={() => {
            setSent(true);
          }}
        />
      </div>
      <div className="flex flex-col items-center gap-2">
        <QrCode value={link.url} label={text('linkQr')} />
        <p className="m-0 max-w-(--shifa-width-37-5) text-center text-caption leading-body text-text-muted">
          {text('linkQrNote')}
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
