// "Shown" source of truth (criterion 4): the host polls `dumpsys notification --noredact` and
// records each posted notification of the probe's package with its post time and the s7id, which
// the sender and the probe put in the ticker text. Works in every app state, including those where
// no app code runs. Only the "Notification List" section is read (not the enqueued or archived
// ones). Post time: `postTime`, else `mUpdateTimeMs`, else `mCreationTimeMs`, else `when`
// (emulator clock).
import { type Device } from './adb.ts';

export interface Posted {
  key: string;
  s7id: string;
  channel: string;
  postTimeMs: number;
}

export interface ShownRecord extends Posted {
  serial: string;
  /** Host clock when the watcher first saw it. */
  seenAtMs: number;
}

const field = (block: string, name: string): string | undefined =>
  new RegExp(`(?:^|\\s)${name}=(\\S+)`, 'm').exec(block)?.[1];

function postTime(block: string): number | undefined {
  for (const name of ['postTime', 'mUpdateTimeMs', 'mCreationTimeMs', 'when']) {
    const v = field(block, name);
    if (v && /^\d+$/.test(v) && v !== '0') return Number(v);
  }
  return undefined;
}

function notificationList(dump: string): string[] {
  const lines = dump.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s{2}Notification List:\s*$/.test(l));
  if (start < 0) return [];
  const blocks: string[] = [];
  let current: string[] | undefined;
  for (const line of lines.slice(start + 1)) {
    // A line indented two spaces or less opens the next section.
    if (line.trim() !== '' && !/^\s{3}/.test(line)) break;
    if (/^\s*NotificationRecord\(/.test(line)) {
      if (current) blocks.push(current.join('\n'));
      current = [line];
    } else current?.push(line);
  }
  if (current) blocks.push(current.join('\n'));
  return blocks;
}

export function parseNotifications(dump: string, pkg: string): Posted[] {
  const out: Posted[] = [];
  for (const block of notificationList(dump)) {
    const header = block.split('\n')[0] ?? '';
    if (field(header, 'pkg') !== pkg) continue;
    const s7id = /^\s*tickerText=(.+?)\s*$/m.exec(block)?.[1];
    // In the header the key is followed by ": Notification(...)".
    const key = field(header, 'key')?.replace(/:$/, '');
    const time = postTime(block);
    if (!s7id || s7id === 'null' || !key || time === undefined) continue;
    out.push({
      key,
      s7id,
      channel: /Notification\(channel=([^\s)]+)/.exec(header)?.[1] ?? 'unknown',
      postTimeMs: time,
    });
  }
  return out;
}

const SNOOZE_MS = 30 * 24 * 3600_000;

/**
 * Android keeps at most 50 posted notifications per package and silently drops the rest
 * ("Package has already posted or enqueued 50 notifications"), so runs that leave their pushes in
 * the tray would hide later ones. Snoozing a notification takes it out of that count and out of
 * the dump the watcher reads. Only acts when the package holds `atLeast` notifications; returns
 * how many it snoozed.
 */
export async function clearTray(dev: Device, pkg: string, atLeast = 1): Promise<number> {
  const keys = (await dev.shell('cmd notification list'))
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.split('|')[1] === pkg);
  if (keys.length < atLeast) return 0;
  for (const key of keys)
    await dev.shell(`cmd notification snooze --for ${String(SNOOZE_MS)} '${key}'`);
  return keys.length;
}

export function createWatcher(opts: { dev: Device; pkg: string; nowMs: () => number }) {
  const seen = new Map<string, ShownRecord>();
  return {
    /** Polls once; returns the notifications not seen before (by s7id). */
    poll: async (): Promise<ShownRecord[]> => {
      const dump = await opts.dev.shell('dumpsys notification --noredact');
      const fresh: ShownRecord[] = [];
      for (const p of parseNotifications(dump, opts.pkg)) {
        if (seen.has(p.s7id)) continue;
        const record = { ...p, serial: opts.dev.serial, seenAtMs: opts.nowMs() };
        seen.set(p.s7id, record);
        fresh.push(record);
      }
      return fresh;
    },
    records: (): ShownRecord[] => [...seen.values()],
  };
}

export type Watcher = ReturnType<typeof createWatcher>;
