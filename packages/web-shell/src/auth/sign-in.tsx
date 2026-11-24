// Sign-in (slice A-01-07 checkpoint 2), as the owner approved it on 2026-11-24 ("Shifa Screens ·
// Clinic web", page "A-01-07 Sign-in batch", prototype `Main`), shared by both apps.
// POST /auth/sign-in with the phone as typed (the server normalises any digit form) → the session
// goes into the cache and the guard routes it (MFA, chooser, admin web). Answers: 401
// `invalid_credentials` one message under the password; 429 `phone_locked`, `ip_blocked` a
// warning with a countdown to `until`, the form off until then (improvement b); a network failure
// or 5xx a danger callout with retry, retried by itself when the connection returns (j). The
// last phone that signed in is remembered on this device (i) and the password field warns of
// Caps Lock and Arabic letters (g). `?reason=` shows why the person is here.
import { Button, Callout, Icon, Input, PasswordInput } from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type KeyboardEvent, type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { sessionQueryKey } from '../session.ts';
import { useErrorText, useText } from '../text.ts';
import { AuthLayout } from './auth-layout.tsx';
import { clockTime, remaining } from './lock.ts';
import { SignInNotice } from './sign-in-notice.tsx';

/** The last phone that signed in on this device (improvement i): a convenience, never relied on. */
const REMEMBERED = 'shifa.signIn.phone';

function readRemembered(): string {
  try {
    return localStorage.getItem(REMEMBERED) ?? '';
  } catch {
    return '';
  }
}

function writeRemembered(phone: string | null): void {
  try {
    if (phone === null) localStorage.removeItem(REMEMBERED);
    else localStorage.setItem(REMEMBERED, phone);
  } catch {
    // Storage blocked: nothing is remembered.
  }
}

/** Examples in the phone hint (synthetic, `00` marker numbers of the plan). */
const EXAMPLES = { local: '0930012345', international: '‎+905300012345' };

type Failure =
  | { kind: 'invalid' }
  | { kind: 'lock'; code: 'phone_locked' | 'ip_blocked'; until: number }
  | { kind: 'network' };

const ARABIC_LETTER = /[؀-ۿ]/;

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [active]);
  return now;
}

export function SignInPage() {
  const text = useText();
  const errorText = useErrorText();
  const { app, shell } = useShell();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search: { reason?: string; minutes?: number } = useSearch({ strict: false });

  const [remembered, setRemembered] = useState(readRemembered);
  const [phone, setPhone] = useState(remembered);
  const [password, setPassword] = useState('');
  const [empty, setEmpty] = useState({ phone: false, password: false });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [capsLock, setCapsLock] = useState(false);
  const sent = useRef<{ phone: string; password: string } | null>(null);

  const locked = failure?.kind === 'lock';
  const now = useNow(locked);
  const lockEnded = locked && now >= failure.until;
  useEffect(() => {
    if (lockEnded) setFailure(null);
  }, [lockEnded]);

  async function send(values: { phone: string; password: string }) {
    sent.current = values;
    setBusy(true);
    try {
      const { data, error } = await shell.api.POST('/auth/sign-in', { body: values });
      if (data) {
        writeRemembered(values.phone);
        queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: data });
        await navigate({ to: '/' });
        return;
      }
      const { code, until } = errorFacts(error);
      if (code === 'invalid_credentials') setFailure({ kind: 'invalid' });
      else if ((code === 'phone_locked' || code === 'ip_blocked') && until !== undefined) {
        setFailure({ kind: 'lock', code, until });
      } else setFailure({ kind: 'network' });
    } catch {
      setFailure({ kind: 'network' });
    } finally {
      setBusy(false);
    }
  }

  // Improvement j: the connection came back after a failed attempt → the same attempt again.
  const network = failure?.kind === 'network';
  useEffect(() => {
    if (!network) return undefined;
    const again = () => {
      if (sent.current) void send(sent.current);
    };
    globalThis.addEventListener('online', again);
    return () => {
      globalThis.removeEventListener('online', again);
    };
  });

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || locked) return;
    const missing = { phone: phone.trim() === '', password: password === '' };
    setEmpty(missing);
    if (missing.phone || missing.password) return;
    void send({ phone: phone.trim(), password });
  }

  // A Latin letter tells the state for sure (upper case without Shift, or lower case with it,
  // means Caps Lock is on); the Caps Lock key itself is read from the modifier state.
  const watchCaps = (event: KeyboardEvent) => {
    const { key } = event;
    if (key.length === 1 && /[a-z]/i.test(key)) {
      setCapsLock((key === key.toUpperCase()) !== event.shiftKey);
    } else if (key === 'CapsLock') {
      setCapsLock(event.getModifierState('CapsLock'));
    }
  };

  const keyboardHint = capsLock
    ? text('signInCapsLock')
    : ARABIC_LETTER.test(password)
      ? text('signInArabicLetters')
      : null;

  let phoneHint = text('signInPhoneHint', EXAMPLES);
  if (remembered !== '' && phone === remembered) phoneHint = text('signInPhoneRemembered');

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-heading-md leading-heading font-semibold">{text('signInTitle')}</h1>
        <p className="m-0 text-body leading-body text-text-muted">
          {text(app === 'admin' ? 'signInAdminLine' : 'signInClinicLine')}
        </p>
      </div>
      {search.reason === undefined ? null : (
        <SignInNotice reason={search.reason} minutes={search.minutes} />
      )}
      {failure?.kind === 'lock' && (
        <Callout
          data-testid="sign-in-error"
          data-code={failure.code}
          tone="warning"
          icon="clock"
          title={text(failure.code === 'phone_locked' ? 'lockPhoneTitle' : 'lockIpTitle')}
        >
          {text(failure.code === 'phone_locked' ? 'lockPhoneText' : 'lockIpText')}{' '}
          <span className="tabular-nums">
            {text('lockWait', {
              wait: remaining(failure.until - now),
              time: clockTime(failure.until),
            })}
          </span>
        </Callout>
      )}
      {failure?.kind === 'network' && (
        <Callout
          data-testid="sign-in-error"
          data-code="network"
          tone="danger"
          icon="wifi-slash"
          title={text('unreachableTitle')}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (sent.current) void send(sent.current);
              }}
            >
              {text('retry')}
            </Button>
          }
        >
          {text('unreachableText')}
        </Callout>
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Input
            label={text('signInPhone')}
            type="tel"
            dir="ltr"
            startIcon="phone"
            value={phone}
            onValueChange={(value) => {
              setPhone(value);
              setEmpty((e) => ({ ...e, phone: false }));
            }}
            hint={phoneHint}
            error={empty.phone ? text('signInPhoneEmpty') : undefined}
            disabled={locked}
          />
          {remembered !== '' && phone === remembered && !locked && (
            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  writeRemembered(null);
                  setRemembered('');
                  setPhone('');
                }}
              >
                {text('signInForgetPhone')}
              </Button>
            </div>
          )}
        </div>
        {/* Keys bubble here from the password field: Caps Lock is read from them (improvement g). */}
        <div className="flex flex-col gap-2" onKeyDown={watchCaps} onKeyUp={watchCaps}>
          <PasswordInput
            label={text('signInPassword')}
            autoComplete="current-password"
            value={password}
            onValueChange={(value) => {
              setPassword(value);
              setEmpty((e) => ({ ...e, password: false }));
              if (failure?.kind === 'invalid') setFailure(null);
            }}
            error={
              empty.password
                ? text('signInPasswordEmpty')
                : failure?.kind === 'invalid'
                  ? errorText('invalid_credentials')
                  : undefined
            }
            disabled={locked}
          />
          {keyboardHint !== null && (
            <p className="m-0 flex items-center gap-2 text-data leading-body text-status-warning-fg">
              <Icon name="warning" />
              {keyboardHint}
            </p>
          )}
        </div>
        <Button variant="primary" size="lg" type="submit" loading={busy} disabled={locked}>
          {text('signInSubmit')}
        </Button>
      </form>
      <p className="m-0 text-data leading-body text-text-muted">{text('signInHelp')}</p>
    </AuthLayout>
  );
}
