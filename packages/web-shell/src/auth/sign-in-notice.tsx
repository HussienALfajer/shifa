// Why the person is on sign-in (`?reason=`; slice A-01-07, spec gap 4): signed out for
// inactivity (by this page's timer, with the minutes, or by the server), the 12-hour limit, a
// session ended elsewhere (another device, the owner, the super admin, a new password), an
// expiry the server did not explain, a person who is not an admin on admin web, a sign-out that
// worked, and one that may not have. Any other value reads as an expired session.
import type { CommonKey } from '@shifa/i18n';
import { Callout, type CalloutTone, type IconName } from '@shifa/ui';
import { useText } from '../text.ts';

interface Notice {
  tone: CalloutTone;
  icon: IconName;
  title: CommonKey;
  text: CommonKey;
}

const EXPIRED: Notice = {
  tone: 'info',
  icon: 'info',
  title: 'noticeExpiredTitle',
  text: 'noticeExpiredText',
};

const NOTICES: Record<string, Notice> = {
  idle: { tone: 'info', icon: 'clock', title: 'noticeIdleTitle', text: 'noticeIdleText' },
  absolute: {
    tone: 'info',
    icon: 'clock',
    title: 'noticeAbsoluteTitle',
    text: 'noticeAbsoluteText',
  },
  ended: { tone: 'info', icon: 'info', title: 'noticeEndedTitle', text: 'noticeEndedText' },
  session_expired: EXPIRED,
  not_admin: {
    tone: 'warning',
    icon: 'warning',
    title: 'noticeNotAdminTitle',
    text: 'noticeNotAdminText',
  },
  signed_out: {
    tone: 'success',
    icon: 'check-circle',
    title: 'noticeSignedOutTitle',
    text: 'noticeSignedOutText',
  },
  sign_out_failed: {
    tone: 'warning',
    icon: 'warning',
    title: 'noticeSignOutFailedTitle',
    text: 'noticeSignOutFailedText',
  },
};

export function SignInNotice({
  reason,
  minutes,
}: {
  reason: string;
  minutes?: number | undefined;
}) {
  const text = useText();
  const notice = Object.hasOwn(NOTICES, reason) ? (NOTICES[reason] ?? EXPIRED) : EXPIRED;
  const body =
    reason === 'idle' && minutes !== undefined
      ? text('noticeIdleMinutes', { count: minutes })
      : text(notice.text);
  return (
    <Callout
      data-testid="sign-in-reason"
      data-reason={reason}
      tone={notice.tone}
      icon={notice.icon}
      title={text(notice.title)}
    >
      {body}
    </Callout>
  );
}
