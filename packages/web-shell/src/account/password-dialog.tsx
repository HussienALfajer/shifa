// «تغيير كلمة المرور» (slice A-01-10 checkpoint 2; prototype `Account10`): the current password,
// the new one with its rules ticked while typing (improvement a: length, no phone digits, not the
// current one; the common-word check is the server's), and the repeat, checked before sending.
// POST /auth/password: 401 `invalid_credentials` under the current password (never a sign-out,
// A-01-09); each 400 rule under the new one; 429 `phone_locked` the lock, the fields disabled;
// no answer a callout, the input kept. Success rotates this session (OD-92): the new session goes
// into the cache as this tab's own rotation, the other devices are gone and the page says how
// many. Passwords live in this dialog's state only.
import {
  Button,
  Callout,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  Icon,
  PasswordInput,
} from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { type Lock, lockOf, useLock } from '../auth/lock.ts';
import { LockCallout } from '../auth/lock-callout.tsx';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { expectOwnRotation, sessionQueryKey } from '../session.ts';
import { useText } from '../text.ts';
import type { Tell } from './account-page.tsx';
import { sessionsKey, useProfile, useSessions, useSignedIn } from './data.ts';

const MIN = 10;
/** The contract's limit (`ChangePasswordRequest`): checked here, never a server error (review 5). */
const MAX = 128;

type Problem =
  | 'empty'
  | 'mismatch'
  | 'wrong'
  | 'too_long'
  | 'password_too_short'
  | 'password_common'
  | 'password_contains_phone'
  | 'password_unchanged'
  | 'network'
  | 'server'
  | null;

const NEW_ERRORS = {
  too_long: 'pwTooLong',
  password_too_short: 'pwTooShort',
  password_common: 'pwCommon',
  password_contains_phone: 'pwContainsPhone',
  password_unchanged: 'pwUnchanged',
} as const;

const isNewError = (p: Problem): p is keyof typeof NEW_ERRORS => p !== null && p in NEW_ERRORS;

/** The phone's last seven digits inside the password (or the other way round), as the server checks. */
function holdsPhone(password: string, phone: string): boolean {
  const typed = password.replace(/\D/g, '');
  const own = phone.replace(/\D/g, '');
  return typed.length >= 7 && (own.includes(typed.slice(-7)) || typed.includes(own.slice(-7)));
}

function Rule({ ok, children }: { ok: boolean; children: string }) {
  return (
    <span
      data-testid="pw-rule"
      data-ok={String(ok)}
      className={
        ok
          ? 'flex items-center gap-2 text-data text-status-success-fg'
          : 'flex items-center gap-2 text-data text-text-muted'
      }
    >
      <Icon name={ok ? 'check-circle' : 'minus'} />
      {children}
    </span>
  );
}

export function PasswordDialog({
  open,
  onOpenChange,
  tell,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tell: Tell;
}) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const session = useSignedIn();
  const userId = session?.userId ?? '';
  const { data: profile } = useProfile(userId);
  const { data: sessions } = useSessions(userId);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [problem, setProblem] = useState<Problem>(null);
  const [busy, setBusy] = useState(false);
  const [lockState, setLock] = useState<Lock | null>(null);
  const clear = useCallback(() => {
    setLock(null);
  }, []);
  const { lock, now } = useLock(lockState, clear);
  const locked = lock !== null;

  function reset(nextOpen: boolean) {
    if (!nextOpen) {
      setCurrent('');
      setNext('');
      setRepeat('');
      setProblem(null);
    }
    onOpenChange(nextOpen);
  }

  async function submit() {
    if (busy || locked || !session) return;
    if (current === '' || next === '') {
      setProblem('empty');
      return;
    }
    if (next.length > MAX) {
      setProblem('too_long');
      return;
    }
    if (next !== repeat) {
      setProblem('mismatch');
      return;
    }
    if (current.length > MAX) {
      // Longer than any password the server accepts: it cannot be the current one.
      setProblem('wrong');
      return;
    }
    setBusy(true);
    setProblem(null);
    // From the list on screen; unknown when it has not loaded (review 6): then the neutral words.
    const others = sessions?.filter((s) => !s.current).length;
    try {
      const { data, error, response } = await shell.api.POST('/auth/password', {
        body: { currentPassword: current, newPassword: next },
      });
      if (data) {
        expectOwnRotation(session.sessionId);
        queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: data });
        await queryClient.invalidateQueries({ queryKey: sessionsKey(userId) });
        reset(false);
        tell({
          tone: 'success',
          title: text('pwDoneTitle'),
          text:
            others === undefined
              ? text('pwDoneNeutral')
              : others > 0
                ? text('pwDoneOthers', { count: others })
                : text('pwDoneAlone'),
        });
        return;
      }
      const { code, until } = errorFacts(error);
      if (code === 'invalid_credentials') setProblem('wrong');
      else if (code === 'phone_locked' && until !== undefined)
        setLock(lockOf(code, until, response));
      else if (code in NEW_ERRORS) setProblem(code as Problem);
      else setProblem('server');
    } catch {
      setProblem('network');
    } finally {
      setBusy(false);
    }
  }

  const phone = profile?.phoneE164 ?? '';
  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent title={text('pwOpen')} closeLabel={text('close')}>
        {lock && (
          <LockCallout
            lock={lock}
            now={now}
            title={text('pwLockTitle')}
            text={text('pwLockText')}
          />
        )}
        {(problem === 'network' || problem === 'server') && (
          <Callout
            tone="danger"
            icon={problem === 'network' ? 'wifi-slash' : 'warning'}
            title={text(problem === 'network' ? 'pwUnreachableTitle' : 'actionFailedTitle')}
          >
            {text(problem === 'network' ? 'pwUnreachableText' : 'serverErrorText')}
          </Callout>
        )}
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <PasswordInput
            label={text('pwCurrent')}
            autoComplete="current-password"
            value={current}
            disabled={locked}
            error={
              problem === 'wrong'
                ? text('pwWrongCurrent')
                : problem === 'empty' && current === ''
                  ? text('pwEmpty')
                  : undefined
            }
            onValueChange={(value) => {
              setCurrent(value);
              if (problem === 'wrong' || problem === 'empty') setProblem(null);
            }}
          />
          <div className="flex flex-col gap-2">
            <PasswordInput
              label={text('pwNew')}
              autoComplete="new-password"
              value={next}
              disabled={locked}
              error={
                isNewError(problem)
                  ? text(NEW_ERRORS[problem], { min: MIN, max: MAX })
                  : problem === 'empty' && next === ''
                    ? text('pwEmpty')
                    : undefined
              }
              onValueChange={(value) => {
                setNext(value);
                if (isNewError(problem) || problem === 'empty') setProblem(null);
              }}
            />
            <div className="flex flex-col gap-1">
              <Rule ok={next.length >= MIN}>
                {text('pwRuleLength', { min: MIN, count: next.length })}
              </Rule>
              <Rule ok={next !== '' && !holdsPhone(next, phone)}>{text('pwRulePhone')}</Rule>
              <Rule ok={next !== '' && next !== current}>{text('pwRuleChanged')}</Rule>
            </div>
          </div>
          <PasswordInput
            label={text('pwRepeat')}
            autoComplete="new-password"
            value={repeat}
            disabled={locked}
            error={problem === 'mismatch' ? text('pwMismatch') : undefined}
            onValueChange={(value) => {
              setRepeat(value);
              if (problem === 'mismatch') setProblem(null);
            }}
          />
          <p className="m-0 text-caption leading-body text-text-muted">{text('pwFootnote')}</p>
          <DialogActions>
            <DialogClose>{text('back')}</DialogClose>
            <Button type="submit" variant="primary" loading={busy} disabled={locked}>
              {text('pwSubmit')}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
