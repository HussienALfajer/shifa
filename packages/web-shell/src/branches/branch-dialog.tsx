// «إضافة فرع» and «تعديل» (slice A-01-08 checkpoint 4; prototype `Team08`; the `POST`, `PATCH
// /branches` row of the slice's table; A-01b criterion 9): the name required before sending,
// address and phone optional. An edit sends only what changed (a cleared address or phone as
// null) and «حفظ» waits for a change. 400 `body.phone` under the phone; 409 `branch_archived`
// and 404 close it and are named on the page, the list read again; no connection keeps the input.
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
import { type Branch, NAME_MAX, PHONE_MAX } from '../team/data.ts';
import { useText } from '../text.ts';
import type { PageNote } from './branch-note.tsx';

const ADDRESS_MAX = 300;

type Problem = 'name' | 'phone' | 'network' | 'server' | null;

/** The typed value, trimmed; empty is null (no address, no phone). */
const valueOf = (typed: string) => (typed.trim() === '' ? null : typed.trim());

export function BranchDialog({
  branch,
  onSaved,
  onRefused,
  onClose,
}: {
  /** The branch edited; none to add. */
  branch?: Branch;
  onSaved: (saved: Branch, added: boolean) => void;
  /** A refusal the dialog cannot fix: it closes and the page names it. */
  onRefused: (note: PageNote) => void;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const [name, setName] = useState(branch?.name ?? '');
  const [address, setAddress] = useState(branch?.address ?? '');
  const [phone, setPhone] = useState(branch?.phone ?? '');
  const [problem, setProblem] = useState<Problem>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const changes = {
    ...(name.trim() !== branch?.name ? { name: name.trim() } : {}),
    ...(valueOf(address) !== (branch?.address ?? null) ? { address: valueOf(address) } : {}),
    ...(valueOf(phone) !== (branch?.phone ?? null) ? { phone: valueOf(phone) } : {}),
  };
  const changed = Object.keys(changes).length > 0;

  async function send() {
    if (inFlight.current) return;
    if (name.trim() === '') {
      setProblem('name');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const answer =
        branch === undefined
          ? await shell.api.POST('/branches', {
              body: {
                name: name.trim(),
                ...(valueOf(address) === null ? {} : { address: valueOf(address) }),
                ...(valueOf(phone) === null ? {} : { phone: valueOf(phone) }),
              },
            })
          : await shell.api.PATCH('/branches/{id}', {
              params: { path: { id: branch.id } },
              body: changes,
            });
      const { data, error, response } = answer;
      if (data) {
        onSaved(data, branch === undefined);
        return;
      }
      const { code } = errorFacts(error);
      if (phoneRefused(error, 'body.phone')) setProblem('phone');
      else if (code === 'branch_archived') {
        onRefused({
          tone: 'warning',
          title: text('branchGoneArchivedTitle'),
          text: text('branchGoneArchivedText'),
        });
      } else if (response.status === 404) {
        onRefused({
          tone: 'warning',
          title: text('branchGoneTitle'),
          text: text('branchGoneText'),
        });
      } else setProblem('server');
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const keepProblem = problem === 'network' || problem === 'server';
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        title={
          branch === undefined
            ? text('branchAddTitle')
            : text('branchEditTitle', { name: branch.name })
        }
        closeLabel={text('close')}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <Input
            label={text('branchName')}
            maxLength={NAME_MAX}
            value={name}
            onValueChange={(v) => {
              setName(v);
              if (problem === 'name') setProblem(null);
            }}
            error={problem === 'name' ? text('branchNameMissing') : undefined}
          />
          <Input
            label={text('branchAddress')}
            hint={text('branchOptional')}
            maxLength={ADDRESS_MAX}
            value={address}
            onValueChange={setAddress}
          />
          <Input
            label={text('branchPhone')}
            hint={text('branchPhoneHint')}
            maxLength={PHONE_MAX}
            type="tel"
            dir="ltr"
            value={phone}
            onValueChange={(v) => {
              setPhone(v);
              if (problem === 'phone') setProblem(null);
            }}
            error={problem === 'phone' ? text('phoneInvalid') : undefined}
          />
          {keepProblem && (
            <Callout
              tone="danger"
              icon={problem === 'network' ? 'wifi-slash' : 'warning'}
              title={text(problem === 'network' ? 'unreachableTitle' : 'actionFailedTitle')}
            >
              {text(problem === 'network' ? 'branchNetworkText' : 'serverErrorText')}
            </Callout>
          )}
          <DialogActions>
            <DialogClose>{text('back')}</DialogClose>
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              disabled={branch !== undefined && !changed}
            >
              {branch === undefined ? text('branchAddSubmit') : text('save')}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
