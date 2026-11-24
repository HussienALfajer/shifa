// Correcting a pending owner's phone on admin web (slice A-01-10 checkpoint 3; OD-99; prototype
// `Main`): PATCH /platform/clinics/:id/owner with the right phone answers a new link, shown once by
// the owner card; the earlier link stops working. 400 on `body.phone` under the field; 409
// `owner_account_exists` (set up meanwhile) closes and reads the clinic again; 409
// `owner_setup_pending` (the phone owns another clinic not set up) says what to do; no connection
// keeps the input.
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
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import type { SetupLink } from './data.ts';
import { phoneRefused } from './phone.ts';

type Problem = 'phone' | 'missing' | 'pending' | 'network' | 'server' | null;

export function PhoneDialog({
  clinicId,
  onIssued,
  onSetUp,
  onClose,
}: {
  clinicId: string;
  onIssued: (link: SetupLink) => void;
  onSetUp: () => void;
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
      const { data, error } = await shell.api.PATCH('/platform/clinics/{id}/owner', {
        params: { path: { id: clinicId } },
        body: { phone: phone.trim() },
      });
      if (data) {
        onIssued(data);
        return;
      }
      const { code } = errorFacts(error);
      if (phoneRefused(error, 'body.phone')) setProblem('phone');
      else if (code === 'owner_account_exists') onSetUp();
      else if (code === 'owner_setup_pending') setProblem('pending');
      else setProblem('server');
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title={text('ownerFixPhoneTitle')} closeLabel={text('close')}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <p className="m-0 text-body leading-body">{text('ownerFixPhoneText')}</p>
          <Input
            label={text('ownerFixPhoneField')}
            type="tel"
            dir="ltr"
            hint={text('fieldOwnerPhoneHint')}
            value={phone}
            onValueChange={(v) => {
              setPhone(v);
              if (problem === 'phone' || problem === 'missing') setProblem(null);
            }}
            error={
              problem === 'phone'
                ? text('phoneInvalid')
                : problem === 'missing'
                  ? text('createPhoneMissing')
                  : undefined
            }
          />
          {problem === 'pending' && (
            <Callout tone="warning" title={text('createPendingTitle')}>
              {text('createPendingText')}
            </Callout>
          )}
          {(problem === 'network' || problem === 'server') && (
            <Callout
              tone="danger"
              icon={problem === 'network' ? 'wifi-slash' : 'warning'}
              title={text(problem === 'network' ? 'unreachableTitle' : 'actionFailedTitle')}
            >
              {text(problem === 'network' ? 'adminNetworkText' : 'serverErrorText')}
            </Callout>
          )}
          <DialogActions>
            <DialogClose>{text('back')}</DialogClose>
            <Button type="submit" variant="primary" loading={busy}>
              {text('ownerFixPhoneAction')}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
