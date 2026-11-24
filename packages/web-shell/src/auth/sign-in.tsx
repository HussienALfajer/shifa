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
import { clockTime, remaining, serverOffset, useNow } from './lock.ts';
import { SignInNotice } from './sign-in-notice.tsx';

/**
 * The last phone that signed in to clinic web on this device (improvement i): a convenience,
 * never relied on. Forgotten after 14 days, on «ليس رقمك؟» and on a deliberate sign-out (the
 * person is leaving this computer); never kept on admin web (security review L2).
 */
const REMEMBERED = 'shifa.signIn.phone';
const REMEMBERED_AT = 'shifa.signIn.phoneAt';
const REMEMBER_FOR_MS = 14 * 24 * 60 * 60_000;

function readRemembered(): string {
  try {
    const phone = localStorage.getItem(REMEMBERED) ?? '';
    const at = Number(localStorage.getItem(REMEMBERED_AT));
    if (phone !== '' && Number.isFinite(at) && at > 0 && Date.now() - at > REMEMBER_FOR_MS) {
      writeRemembered(null);
      return '';
    }
    return phone;
  } catch {
    return '';
  }
}

function writeRemembered(phone: string | null): void {
  try {
    if (phone === null) {
      localStorage.removeItem(REMEMBERED);
      localStorage.removeItem(REMEMBERED_AT);
    } else {
      localStorage.setItem(REMEMBERED, phone);
      localStorage.setItem(REMEMBERED_AT, String(Date.now()));
    }
  } catch {
    // Storage blocked: nothing is remembered.
  }
}

/** A deliberate sign-out forgets the phone before the page reads it. */
function rememberedFor(reason: string | undefined): string {
  if (reason === 'signed_out') writeRemembered(null);
  return readRemembered();
}

/**
 * Examples in the phone hint (synthetic numbers). Each is isolated left to right (LRI … PDI), so
 * the `+` stays before the digits inside the Arabic sentence.
 */
const EXAMPLES = { local: '⁦0930012345⁩', international: '⁦+905300012345⁩' };

type Failure =
  | { kind: 'invalid' }
  /** `until` on the server's clock (shown); `endsAt` the same moment on this device's clock. */
  | { kind: 'lock'; code: 'phone_locked' | 'ip_blocked'; until: number; endsAt: number }
  /** No answer (offline, the request failed) or a server error; `at` is when. */
  | { kind: 'network' | 'server'; at: number };

/** How long after a failed attempt the returning connection may send the form by itself. */
const RETRY_WINDOW_MS = 2 * 60_000;

/** Arabic letters only: Arabic-Indic digits and Arabic punctuation (، ؟) are not a keyboard sign. */
const ARABIC_LETTER = /[ء-يٱ-ۓ]/;

export function SignInPage() {
  const text = useText();
  const errorText = useErrorText();
  const { app, shell } = useShell();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search: { reason?: string; minutes?: number } = useSearch({ strict: false });

  const [remembered, setRemembered] = useState(() =>
    app === 'clinic' ? rememberedFor(search.reason) : '',
  );
  const [phone, setPhone] = useState(remembered);
  const [password, setPassword] = useState('');
  const [empty, setEmpty] = useState({ phone: false, password: false });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [capsLock, setCapsLock] = useState(false);
  // One request at a time: a double press or a flapping connection never sends two (each wrong
  // attempt costs the phone and the clinic's address an attempt on the server).
  const inFlight = useRef(false);

  const locked = failure?.kind === 'lock';
  const now = useNow(locked);
  const lockEnded = locked && now >= failure.endsAt;
  useEffect(() => {
    if (lockEnded) setFailure(null);
  }, [lockEnded]);

  async function send(values: { phone: string; password: string }) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const { data, error, response } = await shell.api.POST('/auth/sign-in', { body: values });
      if (data) {
        if (app === 'clinic') writeRemembered(values.phone);
        queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: data });
        await navigate({ to: '/' });
        return;
      }
      const { code, until } = errorFacts(error);
      // A phone the server cannot read is a wrong phone: the same one message (no hint).
      if (code === 'invalid_credentials' || code === 'validation_failed') {
        setFailure({ kind: 'invalid' });
      } else if ((code === 'phone_locked' || code === 'ip_blocked') && until !== undefined) {
        // The attempt that hit the lock was wrong: it does not wait in the field for the lock.
        setPassword('');
        setFailure({ kind: 'lock', code, until, endsAt: until - serverOffset(response) });
      } else setFailure({ kind: 'server', at: Date.now() });
    } catch {
      setFailure({ kind: 'network', at: Date.now() });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  /** What the fields hold now; null (and the empty field named) when one is empty. */
  function values(): { phone: string; password: string } | null {
    const missing = { phone: phone.trim() === '', password: password === '' };
    setEmpty(missing);
    return missing.phone || missing.password ? null : { phone: phone.trim(), password };
  }

  function retry() {
    if (locked) return;
    const now = values();
    if (now) void send(now);
  }

  // Improvement j: the connection came back soon after a failed attempt, on a page someone is
  // looking at → what the fields hold is sent again. Later, or on a hidden page, nothing is sent
  // by itself: a sign-in never happens at an empty desk (security review M1).
  const network = failure?.kind === 'network' ? failure.at : null;
  useEffect(() => {
    if (network === null) return undefined;
    const again = () => {
      if (Date.now() - network > RETRY_WINDOW_MS) return;
      if (document.visibilityState === 'hidden') return;
      retry();
    };
    globalThis.addEventListener('online', again);
    return () => {
      globalThis.removeEventListener('online', again);
    };
  });

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || locked) return;
    const now = values();
    if (now) void send(now);
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
          {/* The ticking m:ss is for the eyes; screen readers hear the end time once (the
              alert re-reads a changed region, so the countdown would be announced each second). */}
          <span aria-hidden="true" className="tabular-nums">
            {text('lockWait', {
              wait: remaining(failure.endsAt - now),
              time: clockTime(failure.until),
            })}
          </span>
          <span className="sr-only">{text('lockWaitAt', { time: clockTime(failure.until) })}</span>
        </Callout>
      )}
      {(failure?.kind === 'network' || failure?.kind === 'server') && (
        <Callout
          data-testid="sign-in-error"
          data-code="network"
          tone="danger"
          icon={failure.kind === 'network' ? 'wifi-slash' : 'warning'}
          title={text(failure.kind === 'network' ? 'unreachableTitle' : 'serverErrorTitle')}
          action={
            <Button size="sm" variant="secondary" loading={busy} onClick={retry}>
              {text('retry')}
            </Button>
          }
        >
          {text(failure.kind === 'network' ? 'unreachableText' : 'serverErrorText')}
        </Callout>
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Input
            label={text('signInPhone')}
            type="tel"
            dir="ltr"
            startIcon="phone"
            maxLength={32}
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
