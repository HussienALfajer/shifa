// One-day run (criterion 7): one push every 15 minutes from 08:00 to 21:00 local time (53 sends)
// to every target emulator, Doze forced on all of them before the first send and again after each
// one (a high-priority push lets the app out only briefly). A slot already passed by more than a
// minute (the machine slept, a send stalled) is logged as missed and never sent late.
import { device } from './adb.ts';
import {
  type BaseDeps,
  collect,
  describeDevice,
  PROBE_PKG,
  pollUntil,
  type RunRecord,
} from './runner.ts';
import { checkDrift, measureSkew } from './skew.ts';
import { clearTray, createWatcher } from './watcher.ts';

const LATE_MS = 60_000;

export function daySlots(day: Date, fromHour = 8, toHour = 21, everyMin = 15): Date[] {
  const slots: Date[] = [];
  for (let m = fromHour * 60; m <= toHour * 60; m += everyMin) {
    slots.push(
      new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60),
    );
  }
  return slots;
}

/** The quick variant (OD-55): `count` slots `everyS` seconds apart from `start`. */
export function quickSlots(start: Date, count: number, everyS: number): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(start.getTime() + i * everyS * 1000));
}

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export interface DayOptions {
  day: Date;
  targets: { serial: string; installId: string }[];
  /** Seconds after a send before Doze is forced again (default 90). */
  dozeAfterS?: number;
  /** Wait after the last slot for late arrivals (default 300 s). */
  settleS?: number;
  /** Send times instead of the day's 08:00–21:00 slots (the quick variant, OD-55). */
  slots?: Date[];
  /** Seconds between slots, recorded in the run (default 900). */
  gapS?: number;
}

export async function runDay(
  opts: DayOptions,
  deps: BaseDeps,
): Promise<{ records: RunRecord[]; missed: Date[] }> {
  const nowMs = () => deps.now().getTime();
  const targets = opts.targets.map((t) => {
    const dev = device(deps.adb, t.serial);
    return { ...t, dev, watcher: createWatcher({ dev, pkg: PROBE_PKG, nowMs }) };
  });
  const watchers = targets.map((t) => t.watcher);
  const wait = (ms: number) => pollUntil(watchers, deps, nowMs() + ms);
  const forceIdle = async () => {
    for (const t of targets) await t.dev.shell('dumpsys deviceidle force-idle');
  };

  const started = deps.now();
  for (const t of targets) {
    await t.dev.shell('dumpsys battery unplug');
    await t.dev.shell('input keyevent KEYCODE_SLEEP');
    await t.dev.shell('dumpsys deviceidle force-idle');
  }
  const prepared = [];
  for (const t of targets) {
    const info = await describeDevice(t.dev);
    const before = await measureSkew(t.dev, { hostNs: deps.hostNs });
    prepared.push({ t, info, before });
  }

  const missed: Date[] = [];
  const sends = [];
  for (const slot of opts.slots ?? daySlots(opts.day)) {
    if (nowMs() > slot.getTime() + LATE_MS) {
      missed.push(slot);
      deps.log(`day: missed ${hhmm(slot)} (now ${hhmm(deps.now())})`);
      continue;
    }
    await pollUntil(watchers, deps, slot.getTime());
    // 53 slots exceed Android's 50 notifications per package; the watcher has already recorded
    // what is snoozed here.
    for (const t of targets) await clearTray(t.dev, PROBE_PKG, 40);
    for (const t of targets) {
      const lines = await deps.send({
        kind: 'reminder',
        appointmentId: `day-${hhmm(slot).replace(':', '')}`,
        appointmentAt: new Date(slot.getTime() + 2 * 3600_000),
        to: t.installId,
        count: 1,
        collapse: true,
      });
      sends.push(...lines);
      for (const l of lines)
        deps.log(`day ${hhmm(slot)} ${t.serial} ${l.s7id} ${String(l.httpStatus)}`);
    }
    await wait((opts.dozeAfterS ?? 90) * 1000);
    await forceIdle();
  }

  await wait((opts.settleS ?? 300) * 1000);
  const records: RunRecord[] = [];
  for (const { t, info, before } of prepared) {
    const after = await measureSkew(t.dev, { hostNs: deps.hostNs });
    const own = sends.filter((s) => s.installId === t.installId);
    const snapshot = await deps.receiver.device(t.installId);
    records.push({
      meta: {
        kind: 'day',
        state: 'day',
        app: 'compliant',
        pkg: PROBE_PKG,
        serial: t.serial,
        installId: t.installId,
        ...info,
        grading: 'graded',
        count: own.length,
        gapS: opts.gapS ?? 15 * 60,
        startedAt: started.toISOString(),
        endedAt: deps.now().toISOString(),
        skew: checkDrift(before, after),
        ...(snapshot ? { device: snapshot } : {}),
      },
      sends: own,
      shown: t.watcher.records(),
      ...(await collect(deps.receiver, own)),
    });
  }
  for (const t of targets) {
    await t.dev.shell('dumpsys deviceidle unforce');
    await t.dev.shell('dumpsys battery reset');
  }
  return { records, missed };
}
