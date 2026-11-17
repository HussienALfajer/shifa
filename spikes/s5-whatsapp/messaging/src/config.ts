// Configuration and injected dependencies (clock, random source, sleep, log sink), so the
// suites can drive time and randomness.

export type QuietHours =
  | { kind: 'none' }
  /** Daily window in the clinic's time zone, e.g. 21:00–08:00 (end exclusive). */
  | { kind: 'daily'; start: string; end: string }
  /** Absolute window in epoch ms (compressed tests). */
  | { kind: 'window'; from: number; to: number };

export interface PacingConfig {
  /** Random gap between two sends of a session. */
  minGapMs: number;
  maxGapMs: number;
  /** At most this many sends in any rolling window (OD-46: rolling 60 minutes, default 30). */
  capPerWindow: number;
  windowMs: number;
  quiet: QuietHours;
  /** Sends deferred by quiet hours start at the window's end plus a random spread up to this. */
  deferSpreadMs: number;
  /** Typing time grows with the text length, within bounds. */
  typing: { perCharMs: number; minMs: number; maxMs: number };
  /** Waits up to this long happen inside the tick; longer ones defer the tick job. */
  inlineWaitMaxMs: number;
}

export interface SessionConfig {
  name: string;
  /** Logical WAHA container (MSG-09, MSG-10). */
  container: string;
  clinicId: string | null;
  role: 'clinic' | 'platform';
  timeZone: string;
}

export interface ContainerConfig {
  wahaUrl: string;
  apiKey: string;
  hmacKey: string;
}

export interface VerifyConfig {
  /** The platform session's own number (E.164): the `wa.me` link's target. */
  platformNumber: string;
  /** Key of the HMACs that stand for codes and numbers in the database (16+ characters). */
  serverKey: string;
}

export interface MessagingConfig {
  databaseUrl: string;
  containers: Record<string, ContainerConfig> & {
    platform?: ContainerConfig;
    clinics?: ContainerConfig;
  };
  sessions: SessionConfig[];
  /** E.164 numbers that may receive anything outside production (MSG-32). */
  allowlist: Set<string>;
  pacing: PacingConfig;
  /** Per WAHA call. A sendText that times out is "maybe sent" and never retried. */
  sendTimeoutMs: number;
  /** Bearer token of the clinic admin's resume endpoint (roles come in 0.3-S5b). */
  adminToken: string;
  /** off: ticks only by hand (tests); producer: enqueue jobs; worker: also run them. */
  queue: 'off' | 'producer' | 'worker';
  /** Override of the tick job's expiry (tests of expiry mid-send). */
  tickExpireSeconds?: number;
  /** Reverse verification on the platform session (criterion 9). */
  verify: VerifyConfig;
  /**
   * Manual run only: every webhook body and its signature headers are written here (a
   * git-ignored folder, `.cache/s5/raw/`) for the scrubber. Never set in CI.
   */
  rawCaptureDir?: string;
}

export interface Deps {
  now: () => number;
  random: () => number;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
}

export const defaultDeps: Deps = {
  now: Date.now,
  random: Math.random,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log: (line) => process.stdout.write(`${line}\n`),
};

/** Fields a log line may carry. Never a phone number, a body, a code, a key or a message id. */
export interface LogFields {
  clinicId?: string | null;
  patientId?: string;
  session?: string;
  container?: string;
  templateKey?: string;
  reason?: string;
  seq?: number;
  status?: number | string;
  event?: never;
}

export type Logger = (event: string, fields?: LogFields) => void;

export function makeLogger(deps: Deps): Logger {
  return (event, fields = {}) => {
    deps.log(JSON.stringify({ time: new Date(deps.now()).toISOString(), event, ...fields }));
  };
}
