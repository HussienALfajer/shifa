// The TOTP challenge (slice A-01-07 checkpoint 3), as the owner approved it on 2026-11-24 ("Shifa
// Screens · Clinic web", page "A-01-07 Sign-in batch", prototype `Main`): the person greeted by
// name (GET /me), six digits that send themselves when complete (improvement d), or one recovery
// code. POST /auth/mfa/challenge (`method: totp | recovery`). Answers: 400 `invalid_code` (wrong or
// replayed) one message per mode; 429 `mfa_locked` the lock and its countdown, the form off; 409
// `mfa_not_owed` re-reads the session and routes; no answer a callout with retry. After a
// recovery code the codes left go to the next screen's notice; the rotated session goes into the
// cache and the guard routes it.
import { Button, Callout, Input, OtpInput } from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type SyntheticEvent, useCallback, useRef, useState } from 'react';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { type SessionView, sessionQueryKey } from '../session.ts';
import { useText } from '../text.ts';
import { useSignOut } from '../use-sign-out.ts';
import { AuthLayout } from './auth-layout.tsx';
import { type Lock, lockOf, useLock } from './lock.ts';
import { LockCallout } from './lock-callout.tsx';
import { useMyName } from './me.ts';
import { rememberCodesLeft } from './setup-view.ts';

type Method = 'totp' | 'recovery';
type Problem = 'invalid' | 'empty' | 'network' | 'server' | null;

const DIGITS = 6;

export function MfaChallenge({ session }: { session: SessionView }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signOutNow = useSignOut();
  const name = useMyName(session.userId);
  const [method, setMethod] = useState<Method>('totp');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [problem, setProblem] = useState<Problem>(null);
  const [lockState, setLock] = useState<Lock | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const refused = useRef<string | null>(null);
  const clear = useCallback(() => {
    setLock(null);
  }, []);
  const { lock, now } = useLock(lockState, clear);

  async function send(chosen: Method, typed: string) {
    if (inFlight.current || lock !== null) return;
    if (chosen === 'totp' && typed.length !== DIGITS) return;
    if (chosen === 'recovery' && typed.trim() === '') {
      setProblem('empty');
      return;
    }
    // The code just refused, sent again: it would only count toward the lock (security review I5).
    if (chosen === 'recovery' && typed.trim() === refused.current) {
      setProblem('invalid');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const { data, error, response } = await shell.api.POST('/auth/mfa/challenge', {
        body: { method: chosen, code: chosen === 'recovery' ? typed.trim() : typed },
      });
      if (data) {
        if (chosen === 'recovery') rememberCodesLeft(queryClient, data.recoveryCodesLeft);
        queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: data.session });
        await navigate({ to: '/' });
        return;
      }
      const { code: answer, until } = errorFacts(error);
      if (chosen === 'totp') setCode('');
      if (answer === 'invalid_code') {
        if (chosen === 'recovery') refused.current = typed.trim();
        setProblem('invalid');
      } else if (answer === 'mfa_locked' && until !== undefined) {
        setLock(lockOf(answer, until, response));
      } else if (answer === 'mfa_not_owed') {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
        await navigate({ to: '/' });
      } else setProblem('server');
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(method, method === 'totp' ? code : recovery);
  }

  const totp = method === 'totp';
  let intro = text(totp ? 'challengeTextNoName' : 'challengeRecoveryText');
  if (totp && name !== undefined) intro = text('challengeText', { name });

  return (
    <AuthLayout brand={false}>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-heading-md leading-heading font-semibold">
          {text(totp ? 'challengeTitle' : 'challengeRecoveryTitle')}
        </h1>
        <p className="m-0 text-body leading-body text-text-muted">{intro}</p>
      </div>
      {lock !== null && (
        <LockCallout
          lock={lock}
          now={now}
          title={text('lockMfaTitle')}
          text={text('lockMfaText')}
        />
      )}
      {(problem === 'network' || problem === 'server') && (
        <Callout
          tone="danger"
          icon={problem === 'network' ? 'wifi-slash' : 'warning'}
          title={text(problem === 'network' ? 'unreachableTitle' : 'serverErrorTitle')}
        >
          {text(problem === 'network' ? 'unreachableText' : 'serverErrorText')}
        </Callout>
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        {totp ? (
          <OtpInput
            label={text('challengeTitle')}
            value={code}
            onValueChange={(value) => {
              setCode(value);
              if (problem === 'invalid') setProblem(null);
            }}
            onComplete={(typed) => void send('totp', typed)}
            error={problem === 'invalid' ? text('mfaCodeWrong') : undefined}
            disabled={lock !== null}
          />
        ) : (
          <Input
            label={text('challengeRecoveryLabel')}
            dir="ltr"
            maxLength={32}
            spellCheck={false}
            autoCapitalize="off"
            placeholder="xxxxx-xxxxx"
            value={recovery}
            onValueChange={(value) => {
              setRecovery(value);
              if (problem === 'invalid' || problem === 'empty') setProblem(null);
            }}
            hint={text('challengeRecoveryHint')}
            error={
              problem === 'invalid'
                ? text('mfaRecoveryWrong')
                : problem === 'empty'
                  ? text('challengeRecoveryEmpty')
                  : undefined
            }
            disabled={lock !== null}
          />
        )}
        <Button variant="primary" size="lg" type="submit" loading={busy} disabled={lock !== null}>
          {text('confirm')}
        </Button>
      </form>
      <Button
        variant="ghost"
        onClick={() => {
          setProblem(null);
          setMethod(totp ? 'recovery' : 'totp');
        }}
      >
        {text(totp ? 'challengeUseRecovery' : 'challengeUseTotp')}
      </Button>
      <p className="m-0 text-data leading-body text-text-muted">{text('challengeLost')}</p>
      <div>
        <Button variant="ghost" size="sm" startIcon="sign-out" onClick={signOutNow}>
          {text('signOutShort')}
        </Button>
      </div>
    </AuthLayout>
  );
}
