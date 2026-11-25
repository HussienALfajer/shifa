// Correcting a pending member's phone (slice A-01-08 checkpoint 3; OD-103; prototype `Team08`):
// PATCH /team/members/:id/phone answers a new link, shown once by the drawer; the earlier link
// stops. 400 on `body.phone` and 409 `phone_in_team` under the field; 409 `member_account_exists`
// (accepted meanwhile) or `member_deactivated` close it and are named in the drawer; no
// connection keeps the input.
import {
  Button,
  Callout,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  Input,
} from '@shifa/ui';
import { useRef, useState } from 'react';
import { phoneRefused } from '../admin/phone.ts';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import { type MemberLink, PHONE_MAX } from './data.ts';
import { GONE, type Note } from './member-account.tsx';

type Problem = 'phone' | 'missing' | 'in-team' | 'network' | 'server' | null;

const CLOSES: Record<string, Note> = {
  member_account_exists: {
    tone: 'warning',
    title: 'memberAccountExistsTitle',
    text: 'memberAccountExistsText',
  },
  member_deactivated: {
    tone: 'warning',
    title: 'memberDeactivatedTitle',
    text: 'memberDeactivatedText',
  },
};

export function MemberPhoneDialog({
  memberId,
  name,
  onIssued,
  onRefused,
  onClose,
}: {
  memberId: string;
  name: string;
  onIssued: (link: MemberLink) => void;
  onRefused: (note: Note) => void;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const [phone, setPhone] = useState('');
  const [problem, setProblem] = useState<Problem>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function send() {
    if (inFlight.current) return;
    if (phone.trim() === '') {
      setProblem('missing');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const { data, error, response } = await shell.api.PATCH('/team/members/{id}/phone', {
        params: { path: { id: memberId } },
        body: { phone: phone.trim() },
      });
      if (data) {
        onIssued(data);
        return;
      }
      const { code } = errorFacts(error);
      const closes = response.status === 404 ? GONE : CLOSES[code];
      if (phoneRefused(error, 'body.phone')) setProblem('phone');
      else if (code === 'phone_in_team') setProblem('in-team');
      else if (closes) onRefused(closes);
      else setProblem('server');
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const fieldError =
    problem === 'phone'
      ? text('phoneInvalid')
      : problem === 'missing'
        ? text('memberPhoneMissing')
        : problem === 'in-team'
          ? text('memberPhoneInTeam')
          : undefined;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title={text('memberFixPhoneTitle', { name })} closeLabel={text('close')}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <p className="m-0 text-body leading-body">{text('memberFixPhoneText')}</p>
          <Input
            label={text('memberFixPhoneField')}
            maxLength={PHONE_MAX}
            type="tel"
            dir="ltr"
            hint={text('memberPhoneHint')}
            value={phone}
            onValueChange={(v) => {
              setPhone(v);
              if (problem !== 'network' && problem !== 'server') setProblem(null);
            }}
            error={fieldError}
          />
          {(problem === 'network' || problem === 'server') && (
            <Callout
              tone="danger"
              icon={problem === 'network' ? 'wifi-slash' : 'warning'}
              title={text(problem === 'network' ? 'unreachableTitle' : 'actionFailedTitle')}
            >
              {text(problem === 'network' ? 'memberActionUnknown' : 'serverErrorText')}
            </Callout>
          )}
          <DialogActions>
            <DialogClose>{text('back')}</DialogClose>
            <Button type="submit" variant="primary" loading={busy}>
              {text('memberFixPhoneAction')}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
