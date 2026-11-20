// Scenario runner (criteria 4–6): one state on one emulator. Measures skew, sets the state up,
// sends `count` messages `gapS` apart through the sender (inbox first, then FCM), tears the state
// down, waits `settleS` for late arrivals, and returns the run record. The watcher polls the
// notification list every second the whole time.
import { type InboxRecord, type StoredReceipt } from '@shifa-spike/s7-receiver';
import { type SendLogLine, type SendRequest } from '@shifa-spike/s7-sender';
import { type Adb, type Device, device } from './adb.ts';
import { checkDrift, measureSkew, type SkewRecord } from './skew.ts';
import {
  type Exclusion,
  type Grading,
  STATES,
  type StateContext,
  type StateName,
} from './states.ts';
import { createWatcher, type ShownRecord, type Watcher } from './watcher.ts';

export const PROBE_PKG = 'dev.shifa.spike.s7push';
export type App = 'compliant' | 'noshow';
export const pkgFor = (app: App) => (app === 'noshow' ? `${PROBE_PKG}.noshow` : PROBE_PKG);

/** The probe's last device report, without the token. */
export interface DeviceSnapshot {
  tokenHash: string;
  permission: string;
  channels: { appointments: string; general: string };
  appVersion: string;
  sdkInt: number;
  model: string;
  reportedAt: string;
}

export interface ReceiverView {
  receipts: () => Promise<StoredReceipt[]>;
  inbox: () => Promise<InboxRecord[]>;
  device: (installId: string) => Promise<DeviceSnapshot | null>;
}

export interface BaseDeps {
  adb: Adb;
  now: () => Date;
  hostNs: () => bigint;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
  send: (req: SendRequest) => Promise<SendLogLine[]>;
  receiver: ReceiverView;
}

export interface RunDeps extends BaseDeps {
  prompt: (text: string) => Promise<void>;
}

export interface RunMeta {
  kind: 'state' | 'day';
  state: StateName | 'day';
  app: App;
  pkg: string;
  serial: string;
  installId: string;
  sdk: number | null;
  build: string;
  grading: Grading;
  exclusion?: Exclusion;
  count: number;
  gapS: number;
  network?: 'offline';
  networkBackAt?: string;
  startedAt: string;
  endedAt: string;
  skew: SkewRecord;
  device?: DeviceSnapshot;
}

export interface RunRecord {
  meta: RunMeta;
  sends: SendLogLine[];
  shown: ShownRecord[];
  receipts: StoredReceipt[];
  inbox: InboxRecord[];
}

export interface RunOptions {
  state: StateName;
  serial: string;
  app: App;
  installId: string;
  count?: number;
  gapS?: number;
  /** Wait after teardown for late arrivals (default 120 s). */
  settleS?: number;
}

/** Waits until `untilMs` (host clock), polling every watcher about once a second. */
export async function pollUntil(
  watchers: Watcher[],
  deps: Pick<BaseDeps, 'now' | 'sleep'>,
  untilMs: number,
): Promise<void> {
  for (;;) {
    for (const w of watchers) {
      // One failed `dumpsys` must not end a run: latency comes from the post time in the dump, so
      // the next poll still records the notification correctly.
      await w.poll().catch((e: unknown) => {
        process.stderr.write(`poll skipped: ${e instanceof Error ? e.message : String(e)}\n`);
      });
    }
    const left = untilMs - deps.now().getTime();
    if (left <= 0) return;
    await deps.sleep(Math.min(1000, left));
  }
}

export async function describeDevice(dev: Device): Promise<{ sdk: number | null; build: string }> {
  const sdk = Number((await dev.shell('getprop ro.build.version.sdk')).trim());
  const build = (await dev.shell('getprop ro.build.fingerprint')).trim();
  return { sdk: Number.isInteger(sdk) && sdk > 0 ? sdk : null, build };
}

/** Keeps the receiver records that belong to the run's sends. */
export async function collect(receiver: ReceiverView, sends: SendLogLine[]) {
  const ids = new Set(sends.map((s) => s.s7id));
  return {
    receipts: (await receiver.receipts()).filter((r) => ids.has(r.s7id)),
    inbox: (await receiver.inbox()).filter((r) => ids.has(r.s7id)),
  };
}

export async function runState(opts: RunOptions, deps: RunDeps): Promise<RunRecord> {
  const state = STATES[opts.state];
  const dev = device(deps.adb, opts.serial);
  const pkg = pkgFor(opts.app);
  const count = opts.count ?? state.count;
  const gapS = opts.gapS ?? state.gapS;
  const watcher = createWatcher({ dev, pkg, nowMs: () => deps.now().getTime() });
  const ctx: StateContext = { dev, pkg, sleep: deps.sleep, prompt: deps.prompt };
  const wait = (ms: number) => pollUntil([watcher], deps, deps.now().getTime() + ms);

  const started = deps.now();
  const info = await describeDevice(dev);
  const before = await measureSkew(dev, { hostNs: deps.hostNs });
  deps.log(`${opts.state} on ${opts.serial} (${pkg}): setup`);
  await state.setup(ctx);

  const appointmentAt = new Date(started.getTime() + 2 * 3600_000);
  const ttlTo =
    state.send.ttlToOffsetS === undefined
      ? undefined
      : new Date(started.getTime() + state.send.ttlToOffsetS * 1000);
  const sends: SendLogLine[] = [];
  for (let i = 0; i < count; i += 1) {
    if (i > 0) await state.between?.(ctx);
    const lines = await deps.send({
      kind: 'reminder',
      appointmentId: state.send.sameAppointment
        ? `${opts.state}-appt`
        : `${opts.state}-appt-${String(i)}`,
      appointmentAt,
      to: opts.installId,
      count: 1,
      collapse: state.send.collapse,
      ...(ttlTo ? { ttlTo } : {}),
    });
    sends.push(...lines);
    for (const l of lines)
      deps.log(`${String(i + 1)}/${String(count)} ${l.s7id} ${String(l.httpStatus)}`);
    await wait(gapS * 1000);
  }

  let snapshot: DeviceSnapshot | null = null;
  if (state.openBeforeReport) {
    // The app reports permission and channel state on open (criterion 1).
    await dev.shell(`monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`);
    await wait(10_000);
    snapshot = await deps.receiver.device(opts.installId);
    await dev.shell('input keyevent KEYCODE_HOME');
  }
  deps.log(`${opts.state}: teardown`);
  await state.teardown(ctx);
  const networkBackAt = state.network === 'offline' ? deps.now().toISOString() : undefined;
  await wait((opts.settleS ?? 120) * 1000);
  snapshot ??= await deps.receiver.device(opts.installId);
  const after = await measureSkew(dev, { hostNs: deps.hostNs });

  const exclusion = opts.app === 'compliant' ? state.exclusion : undefined;
  const meta: RunMeta = {
    kind: 'state',
    state: opts.state,
    app: opts.app,
    pkg,
    serial: opts.serial,
    installId: opts.installId,
    ...info,
    grading: opts.app === 'noshow' ? 'recorded' : state.grading,
    ...(exclusion ? { exclusion } : {}),
    count,
    gapS,
    ...(state.network ? { network: state.network } : {}),
    ...(networkBackAt ? { networkBackAt } : {}),
    startedAt: started.toISOString(),
    endedAt: deps.now().toISOString(),
    skew: checkDrift(before, after),
    ...(snapshot ? { device: snapshot } : {}),
  };
  return { meta, sends, shown: watcher.records(), ...(await collect(deps.receiver, sends)) };
}
