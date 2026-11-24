// New recovery codes, or a staff member's TOTP enrolment, from My account (slice A-01-10
// checkpoint 2; prototype `Account10`; A-01a criteria 11, 12a). Renewal: a current code (POST
// /auth/mfa/recovery-codes; 400 `invalid_code`, 429 `mfa_locked` with «رموزك القديمة ما زالت
// تعمل»). Enrolment: POST /auth/mfa/enrol/start on opening (QR code, the key in groups of four
// with copy), then a code (POST /auth/mfa/enrol/confirm; 400 `invalid_code`, `clock_skew`; 429;
// 409 `mfa_not_started` starts again; it rotates the session, this tab's own rotation). Both end
// on the ten codes once: copy, print, «حفظتُ الرموز» before «تم». A 409 saying the state changed
// elsewhere re-reads the status and closes. Codes, keys and URIs live in this dialog's state only.
import type { Schemas } from '@shifa/api-client-ts';
import {
  Button,
  Callout,
  Checkbox,
  CodeList,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  OtpInput,
  QrCode,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import logoColour from '../../../../docs/brand/logo/shifa-logo-horizontal-color.svg';
import { dayDate } from '../auth/dates.ts';
import { type Lock, lockOf, useLock } from '../auth/lock.ts';
import { LockCallout } from '../auth/lock-callout.tsx';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { expectOwnRotation, sessionQueryKey } from '../session.ts';
import { useText } from '../text.ts';
import type { Tell } from './account-page.tsx';
import { mfaKey, useActiveClinic, useProfile, useSignedIn } from './data.ts';

const DIGITS = 6;
const grouped = (key: string) => key.replace(/(.{4})(?=.)/g, '$1 ');

type Problem = 'invalid' | 'skew' | 'network' | 'server' | null;

export function CodesDialog({
  kind,
  tell,
  onClose,
}: {
  kind: 'renew' | 'enrol';
  tell: Tell;
  onClose: () => void;
}) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const session = useSignedIn();
  const userId = session?.userId ?? '';
  const { data: profile } = useProfile(userId);
  const clinic = useActiveClinic(session);
  const [key, setKey] = useState<Schemas['TotpEnrolStart'] | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [lockState, setLock] = useState<Lock | null>(null);
  const inFlight = useRef(false);
  const clear = useCallback(() => {
    setLock(null);
  }, []);
  const { lock, now } = useLock(lockState, clear);

  const changedElsewhere = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: mfaKey(userId) });
    onClose();
  }, [queryClient, userId, onClose]);

  const start = useCallback(async () => {
    setProblem(null);
    try {
      const { data, error, response } = await shell.api.POST('/auth/mfa/enrol/start');
      if (data) {
        setKey(data);
        return;
      }
      const { code: answer, until } = errorFacts(error);
      if (answer === 'mfa_locked' && until !== undefined) setLock(lockOf(answer, until, response));
      else if (answer === 'mfa_already_enrolled') await changedElsewhere();
      else setProblem('server');
    } catch {
      setProblem('network');
    }
  }, [shell, changedElsewhere]);

  const started = useRef(false);
  useEffect(() => {
    if (kind !== 'enrol' || started.current) return;
    started.current = true;
    void start();
  }, [kind, start]);

  async function send(typed: string) {
    if (inFlight.current || lock !== null || typed.length !== DIGITS || !session) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      if (kind === 'renew') {
        const { data, error, response } = await shell.api.POST('/auth/mfa/recovery-codes', {
          body: { code: typed },
        });
        if (data) {
          setCodes(data.recoveryCodes);
          return;
        }
        await refused(errorFacts(error), response);
      } else {
        const { data, error, response } = await shell.api.POST('/auth/mfa/enrol/confirm', {
          body: { code: typed },
        });
        if (data) {
          setCodes(data.recoveryCodes);
          if (data.session.sessionId !== session.sessionId) expectOwnRotation(session.sessionId);
          queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: data.session });
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

  async function refused(
    { code: answer, until }: { code: string; until?: number },
    response: Response,
  ) {
    setCode('');
    if (answer === 'invalid_code') setProblem('invalid');
    else if (answer === 'clock_skew') setProblem('skew');
    else if (answer === 'mfa_locked' && until !== undefined)
      setLock(lockOf(answer, until, response));
    else if (answer === 'mfa_not_started') {
      setKey(null);
      await start();
    } else if (answer === 'mfa_not_enrolled' || answer === 'mfa_already_enrolled') {
      await changedElsewhere();
    } else setProblem('server');
  }

  async function finish() {
    await queryClient.invalidateQueries({ queryKey: mfaKey(userId) });
    onClose();
    tell({
      tone: 'success',
      title: text(kind === 'renew' ? 'codesRenewDoneTitle' : 'codesBadge'),
      text: text(kind === 'renew' ? 'codesRenewDoneText' : 'codesEnrolDoneText'),
    });
  }

  const who = [profile?.name, clinic?.name].filter(Boolean).join(' · ');
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // The codes are shown once: the dialog closes only through «تم» once they are on screen.
        if (!open && codes === null) onClose();
      }}
    >
      <DialogContent
        title={text(kind === 'renew' ? 'codesRenew' : 'mfaEnrolOpen')}
        closeLabel={text('close')}
      >
        {codes === null ? (
          <>
            <p className="m-0 text-body leading-body">
              {kind === 'renew' ? text('codesRenewAsk') : text('codesEnrolAsk', { digits: DIGITS })}
            </p>
            {kind === 'enrol' && key && (
              <>
                <QrCode
                  value={key.otpauthUri}
                  label={text('enrolQrLabel')}
                  className="self-center"
                />
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-caption font-medium text-text-muted">
                    {text('codesEnrolKey')}
                  </p>
                  <div className="flex items-center gap-2">
                    <bdi
                      dir="ltr"
                      translate="no"
                      className="flex-1 rounded-input border border-border-default bg-bg-surface-raised px-3 py-2 font-mono text-data break-all"
                    >
                      {grouped(key.manualKey)}
                    </bdi>
                    <Button
                      size="sm"
                      startIcon={copied ? 'check' : 'file-text'}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(key.manualKey);
                          setCopied(true);
                        } catch {
                          // Refused: the key stays on screen to type.
                        }
                      }}
                    >
                      {text(copied ? 'enrolKeyCopied' : 'enrolCopyKey')}
                    </Button>
                  </div>
                </div>
              </>
            )}
            {lock && (
              <LockCallout
                lock={lock}
                now={now}
                title={text('lockMfaTitle')}
                text={`${text('lockMfaText')} ${text('codesOldStillWork')}`}
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
                action={
                  // No key yet: the enrolment's start failed, and only a new start helps (review 4).
                  kind === 'enrol' && !key ? (
                    <Button size="sm" variant="secondary" onClick={() => void start()}>
                      {text('retry')}
                    </Button>
                  ) : undefined
                }
              >
                {text(problem === 'network' ? 'enrolStartFailedText' : 'serverErrorText')}
              </Callout>
            )}
            <OtpInput
              label={text('enrolCodeLabel')}
              value={code}
              onValueChange={(value) => {
                setCode(value);
                if (problem === 'invalid') setProblem(null);
              }}
              onComplete={(typed) => void send(typed)}
              error={problem === 'invalid' ? text('mfaCodeWrong') : undefined}
              disabled={lock !== null || (kind === 'enrol' && !key)}
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
          <>
            <Callout tone="info" title={text('codesOnceTitle')}>
              {text(kind === 'renew' ? 'codesOnceRenew' : 'codesOnceEnrol')}
            </Callout>
            <CodeList
              codes={codes}
              label={text('codesListLabel')}
              copyLabel={text('codesCopy')}
              copiedLabel={text('codesCopied')}
              printLabel={text('codesPrint')}
              print={{
                title: text('codesPrintTitle'),
                who,
                date: text('codesPrintDate', { date: dayDate(Date.now()) }),
                note: text('codesPrintNote'),
                logoSrc: logoColour,
                logoAlt: text('appName'),
              }}
            />
            <Checkbox
              checked={saved}
              onCheckedChange={setSaved}
              description={text('codesSavedNote')}
            >
              {text('codesSaved')}
            </Checkbox>
            <DialogActions>
              <Button variant="primary" disabled={!saved} onClick={() => void finish()}>
                {text('codesDone')}
              </Button>
            </DialogActions>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
