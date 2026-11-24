// «نقل التحقق إلى هاتف جديد» on My account (slice A-01-10 checkpoint 3; OD-98, OD-101; drawn on
// `Account10` and approved 2026-11-24; A-01a criterion 11). Step 1: a code from the old phone
// (POST /auth/mfa/re-enrol/start) answers a new key. Step 2: the QR code and the key, and a code
// from the new phone (POST /auth/mfa/re-enrol/confirm) answers ten new recovery codes, shown once.
// 400 `invalid_code` under the field, `clock_skew` names the phone's clock; 429 `mfa_locked` with
// its countdown (the old phone still works); 409 `mfa_not_enrolled` re-reads the status and
// closes; `mfa_not_started` returns to step 1. The session is not rotated and the other devices
// stay signed in. The key, its URI and the codes live in this dialog's state only.
import type { Schemas } from '@shifa/api-client-ts';
import {
  Button,
  Callout,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  OtpInput,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { type Lock, lockOf, useLock } from '../auth/lock.ts';
import { LockCallout } from '../auth/lock-callout.tsx';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { useText } from '../text.ts';
import type { Tell } from './account-page.tsx';
import { CodesOnce } from './codes-once.tsx';
import { mfaKey, useSignedIn } from './data.ts';
import { TotpKey } from './totp-key.tsx';

const DIGITS = 6;

type Problem = 'invalid' | 'skew' | 'network' | 'server' | null;

export function ReenrolDialog({ tell, onClose }: { tell: Tell; onClose: () => void }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const userId = useSignedIn()?.userId ?? '';
  const [key, setKey] = useState<Schemas['TotpEnrolStart'] | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [lockState, setLock] = useState<Lock | null>(null);
  const inFlight = useRef(false);
  const clear = useCallback(() => {
    setLock(null);
  }, []);
  const { lock, now } = useLock(lockState, clear);

  async function refused(
    { code: answer, until }: { code: string; until?: number },
    response: Response,
  ) {
    setCode('');
    if (answer === 'invalid_code') setProblem('invalid');
    else if (answer === 'clock_skew') setProblem('skew');
    else if (answer === 'mfa_locked' && until !== undefined) {
      setLock(lockOf(answer, until, response));
    } else if (answer === 'mfa_not_started') {
      // The new key was replaced or expired: start again with the old phone.
      setKey(null);
    } else if (answer === 'mfa_not_enrolled') {
      // Reset meanwhile by the owner or the super admin: nothing left to move.
      await queryClient.invalidateQueries({ queryKey: mfaKey(userId) });
      onClose();
    } else setProblem('server');
  }

  async function send(typed: string) {
    if (inFlight.current || lock !== null || typed.length !== DIGITS) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      if (key === null) {
        const { data, error, response } = await shell.api.POST('/auth/mfa/re-enrol/start', {
          body: { code: typed },
        });
        if (data) {
          setKey(data);
          setCode('');
          return;
        }
        await refused(errorFacts(error), response);
      } else {
        const { data, error, response } = await shell.api.POST('/auth/mfa/re-enrol/confirm', {
          body: { code: typed },
        });
        if (data) {
          setKey(null);
          setCodes(data.recoveryCodes);
          return;
        }
        await refused(errorFacts(error), response);
      }
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function finish() {
    await queryClient.invalidateQueries({ queryKey: mfaKey(userId) });
    onClose();
    tell({ tone: 'success', title: text('reenrolDoneTitle'), text: text('reenrolDoneText') });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // The codes are shown once: the dialog closes only through «تم» once they are on screen.
        if (!open && codes === null) onClose();
      }}
    >
      <DialogContent title={text('reenrolOpen')} closeLabel={text('close')}>
        {codes === null ? (
          <>
            <p className="m-0 text-caption font-medium text-text-muted">
              {text(key === null ? 'reenrolStep1' : 'reenrolStep2')}
            </p>
            <p className="m-0 text-body leading-body">
              {key === null ? text('reenrolOldAsk') : text('reenrolNewAsk', { digits: DIGITS })}
            </p>
            {key !== null && <TotpKey value={key} />}
            {lock && (
              <LockCallout
                lock={lock}
                now={now}
                title={text('lockMfaTitle')}
                text={`${text('lockMfaText')} ${text('reenrolOldStillWorks')}`}
              />
            )}
            {problem === 'skew' && (
              <Callout tone="info" icon="clock" title={text('clockSkewTitle')}>
                {text('clockSkewText')}
              </Callout>
            )}
            {(problem === 'network' || problem === 'server') && (
              <Callout
                tone="danger"
                icon={problem === 'network' ? 'wifi-slash' : 'warning'}
                title={text(problem === 'network' ? 'unreachableTitle' : 'actionFailedTitle')}
              >
                {text(problem === 'network' ? 'reenrolNetworkText' : 'serverErrorText')}
              </Callout>
            )}
            <OtpInput
              key={key === null ? 'old' : 'new'}
              label={text(key === null ? 'reenrolOldCode' : 'reenrolNewCode')}
              value={code}
              onValueChange={(value) => {
                setCode(value);
                if (problem === 'invalid') setProblem(null);
              }}
              onComplete={(typed) => void send(typed)}
              error={problem === 'invalid' ? text('mfaCodeWrong') : undefined}
              disabled={lock !== null}
            />
            <DialogActions>
              <DialogClose>{text('back')}</DialogClose>
              <Button
                variant="primary"
                loading={busy}
                disabled={lock !== null}
                onClick={() => send(code)}
              >
                {text('codesContinue')}
              </Button>
            </DialogActions>
          </>
        ) : (
          <CodesOnce codes={codes} note={text('codesOnceRenew')} onDone={() => void finish()} />
        )}
      </DialogContent>
    </Dialog>
  );
}
