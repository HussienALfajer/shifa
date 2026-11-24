// TOTP enrolment (slice A-01-07 checkpoint 3), as the owner approved it on 2026-11-24 ("Shifa
// Screens · Clinic web", page "A-01-07 Sign-in batch", prototype `Main`): three steps — the app,
// the key (the QR code on desktops and tablets; on phones «فتح في تطبيق المصادقة», the otpauth://
// link, leads and the QR folds, spec gap 1), the code — then the ten recovery codes once. POST
// /auth/mfa/enrol/start when the key step first opens (the key is kept going back and forth);
// POST /auth/mfa/enrol/confirm when six digits are typed (improvement d). Answers: 400
// `invalid_code` under the field, `clock_skew` the set-the-clock hint; 429 `mfa_locked` the lock
// and its countdown; 409 `mfa_not_started` starts again, `mfa_already_enrolled` re-reads the
// session and routes; no answer a callout with retry. The key and the URI are never logged,
// stored or shown as a URL; the confirmed session goes into the cache at once (the router keeps
// the page through this rotation) and the codes step goes on.
import type { Schemas } from '@shifa/api-client-ts';
import { Badge, Button, Callout, OtpInput, QrCode } from '@shifa/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorFacts } from '../client.ts';
import { useShell } from '../providers.tsx';
import { type SessionView, sessionQueryKey } from '../session.ts';
import { useText } from '../text.ts';
import { AuthLayout } from './auth-layout.tsx';
import { type Lock, lockOf, useLock } from './lock.ts';
import { LockCallout } from './lock-callout.tsx';
import { useIsPhone } from './media.ts';
import { RecoveryCodes } from './recovery-codes.tsx';

type Start = Schemas['TotpEnrolStart'];

/** Free authenticator apps (names, not words: not translated). */
const APPS = ['Google Authenticator', 'Microsoft Authenticator', 'Aegis'] as const;
const DIGITS = 6;
const PERIOD_SECONDS = 30;

/** `JBSW Y3DP …`: the key in groups of four, easier to type. */
const grouped = (key: string) => key.replace(/(.{4})(?=.)/g, '$1 ');

type Key = { kind: 'idle' | 'loading' | 'failed' } | { kind: 'ready'; start: Start };
type Problem = 'invalid' | 'skew' | 'network' | 'server' | null;

export function MfaEnrol({ session }: { session: SessionView }) {
  const text = useText();
  const { shell } = useShell();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const phone = useIsPhone();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [key, setKey] = useState<Key>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<Problem>(null);
  const [lockState, setLock] = useState<Lock | null>(null);
  const [codes, setCodes] = useState<{ codes: string[]; session: SessionView } | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [opened, setOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const starting = useRef(false);
  const clear = useCallback(() => {
    setLock(null);
  }, []);
  const { lock, now } = useLock(lockState, clear);

  /** The session changed under the page (enrolled elsewhere): read it again and let the guard route. */
  async function reroute() {
    await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
    await navigate({ to: '/' });
  }

  /** One start at a time: a second would replace the key the first is about to show (review N4). */
  async function start() {
    if (starting.current) return;
    starting.current = true;
    setKey({ kind: 'loading' });
    try {
      const { data, error, response } = await shell.api.POST('/auth/mfa/enrol/start');
      if (data) {
        setKey({ kind: 'ready', start: data });
        return;
      }
      const { code: answer, until } = errorFacts(error);
      if (answer === 'mfa_locked' && until !== undefined) {
        // Idle under the lock: the key is asked for again when the lock runs out.
        setKey({ kind: 'idle' });
        setLock(lockOf(answer, until, response));
      } else if (answer === 'mfa_already_enrolled') await reroute();
      else setKey({ kind: 'failed' });
    } catch {
      setKey({ kind: 'failed' });
    } finally {
      starting.current = false;
    }
  }

  // The key step needs a key: on first opening it, after a «not started» answer, and when a lock
  // that refused the start runs out (review N3; improvement b: the form comes back by itself).
  const needsKey = step === 2 && key.kind === 'idle' && lock === null;
  useEffect(() => {
    if (needsKey) void start();
  });

  async function confirm(typed: string) {
    if (inFlight.current || lock !== null || typed.length !== DIGITS) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const { data, error, response } = await shell.api.POST('/auth/mfa/enrol/confirm', {
        body: { code: typed },
      });
      if (data) {
        // The codes first: the verified session must find them on screen, not an enrolment.
        setCodes({ codes: data.recoveryCodes, session: data.session });
        queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: data.session });
        return;
      }
      const { code: answer, until } = errorFacts(error);
      setCode('');
      if (answer === 'invalid_code') setProblem('invalid');
      else if (answer === 'clock_skew') setProblem('skew');
      else if (answer === 'mfa_locked' && until !== undefined) {
        setLock(lockOf(answer, until, response));
      } else if (answer === 'mfa_not_started') {
        setKey({ kind: 'idle' });
        setStep(2);
      } else if (answer === 'mfa_already_enrolled') await reroute();
      else setProblem('server');
    } catch {
      setProblem('network');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  // Enrolled in another tab while this one was on a step (review N7): go on. This tab's own
  // confirmation sets the codes before the verified session, so it stays on them.
  const enrolledElsewhere = session.mfa === 'verified' && codes === null;
  useEffect(() => {
    if (enrolledElsewhere) void navigate({ to: '/' });
  }, [enrolledElsewhere, navigate]);

  if (codes !== null) return <RecoveryCodes codes={codes.codes} session={codes.session} />;

  const admin = session.platformAdmin;
  const titles = [
    text('enrolTitleApp'),
    text(phone ? 'enrolTitleScanPhone' : 'enrolTitleScan'),
    text('enrolTitleCode'),
  ];
  const ready = key.kind === 'ready' ? key.start : null;

  return (
    <AuthLayout brand={false}>
      <div className="flex flex-col items-start gap-2">
        <Badge tone="brand">{text('enrolStep', { step, total: 3 })}</Badge>
        <h1 className="m-0 text-heading-md leading-heading font-semibold">{titles[step - 1]}</h1>
        <p className="m-0 text-body leading-body text-text-muted">
          {text(admin ? 'enrolWhyAdmin' : 'enrolWhyOwner')}
        </p>
      </div>
      {lock !== null && (
        <LockCallout
          lock={lock}
          now={now}
          title={text('lockMfaTitle')}
          text={text('lockMfaText')}
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
          title={text(problem === 'network' ? 'unreachableTitle' : 'serverErrorTitle')}
        >
          {text(problem === 'network' ? 'unreachableText' : 'serverErrorText')}
        </Callout>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-5">
          <p className="m-0 text-body leading-body">{text('enrolAppIntro')}</p>
          <div className="flex flex-wrap gap-2" dir="ltr">
            {APPS.map((name) => (
              <Badge key={name} tone="outline" size="md">
                {name}
              </Badge>
            ))}
          </div>
          <p className="m-0 text-data leading-body text-text-muted">
            {text('enrolAppNote', { digits: DIGITS, seconds: PERIOD_SECONDS })}
          </p>
          <Button
            variant="primary"
            size="lg"
            endIcon="arrow-forward"
            onClick={() => {
              setStep(2);
            }}
          >
            {text('enrolHaveApp')}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          {key.kind === 'failed' ? (
            <Callout
              tone="danger"
              title={text('enrolStartFailedTitle')}
              action={
                <Button size="sm" variant="secondary" onClick={start}>
                  {text('retry')}
                </Button>
              }
            >
              {text('enrolStartFailedText')}
            </Callout>
          ) : (
            <>
              {phone && ready && (
                <div className="flex flex-col gap-2">
                  <Button
                    variant="primary"
                    size="lg"
                    startIcon="arrow-forward"
                    onClick={() => {
                      // Only an authenticator link is ever followed (security review I1).
                      if (!ready.otpauthUri.startsWith('otpauth://totp/')) return;
                      setOpened(true);
                      globalThis.location.assign(ready.otpauthUri);
                    }}
                  >
                    {text('enrolOpenApp')}
                  </Button>
                  {opened && (
                    <p className="m-0 text-data leading-body text-text-muted">
                      {text('enrolOpenedNote')}
                    </p>
                  )}
                </div>
              )}
              {(!phone || showQr) && (
                <div className="flex flex-wrap items-center gap-5">
                  <QrCode value={ready?.otpauthUri} label={text('enrolQrLabel')} />
                  <p className="m-0 min-w-(--shifa-width-60) flex-1 text-data leading-body">
                    {text('enrolScanHow')}
                  </p>
                </div>
              )}
              {ready && (
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-caption leading-body font-medium">
                    {text(phone ? 'enrolKeyLabelPhone' : 'enrolKeyLabelDesk')}
                  </p>
                  {/* Never sent to a page-translation service (security review L5). */}
                  <bdi
                    dir="ltr"
                    translate="no"
                    className="rounded-input border border-border-default bg-bg-surface-raised px-3 py-2 font-mono text-data leading-body font-medium break-all"
                  >
                    {grouped(ready.manualKey)}
                  </bdi>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      startIcon={copied ? 'check' : 'file-text'}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(ready.manualKey);
                          setCopied(true);
                        } catch {
                          // Clipboard refused: the key stays on screen to type.
                        }
                      }}
                    >
                      {text(copied ? 'enrolKeyCopied' : 'enrolCopyKey')}
                    </Button>
                    {phone && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowQr((s) => !s);
                        }}
                      >
                        {text(showQr ? 'enrolHideQr' : 'enrolShowQr')}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              variant="ghost"
              startIcon="arrow-back"
              onClick={() => {
                setStep(1);
              }}
            >
              {text('back')}
            </Button>
            <Button
              variant="primary"
              endIcon="arrow-forward"
              disabled={!ready}
              onClick={() => {
                setProblem(null);
                setStep(3);
              }}
            >
              {text('enrolAdded')}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <OtpInput
            label={text('enrolCodeLabel')}
            value={code}
            onValueChange={(value) => {
              setCode(value);
              if (problem === 'invalid') setProblem(null);
            }}
            onComplete={(typed) => void confirm(typed)}
            error={problem === 'invalid' ? text('mfaCodeWrong') : undefined}
            disabled={lock !== null}
          />
          <Button
            variant="primary"
            size="lg"
            loading={busy}
            disabled={lock !== null}
            onClick={() => confirm(code)}
          >
            {text('confirm')}
          </Button>
          <Button
            variant="ghost"
            startIcon="arrow-back"
            onClick={() => {
              setProblem(null);
              setStep(2);
            }}
          >
            {text('enrolBackToKey')}
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
