// Criterion 4: the host-side watcher reads `dumpsys notification --noredact` and finds the probe's
// notifications with their `s7id` (the ticker) and post time, on both API levels.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { device } from '../src/adb.ts';
import { createWatcher, parseNotifications } from '../src/watcher.ts';
import { createFakeAdb, fakeClock } from './fakes/adb.ts';

const PKG = 'dev.shifa.spike.s7push';
const fixture = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('parseNotifications', () => {
  it('API 33: finds the probe notifications, their s7id and post time; ignores other packages and the enqueued list', () => {
    const posted = parseNotifications(fixture('dumpsys-api33.txt'), PKG);
    expect(posted).toEqual([
      {
        key: `0|${PKG}|0|FCM-Notification:52310|10153`,
        s7id: 's7-0001',
        channel: 'appointments',
        postTimeMs: 1795140123480,
      },
      {
        key: `0|${PKG}|0|FCM-Notification:52388|10153`,
        s7id: 's7-0002',
        channel: 'appointments',
        postTimeMs: 1795140153020,
      },
    ]);
  });

  it('API 36: prefers postTime and does not take the noshow package for the compliant one', () => {
    const posted = parseNotifications(fixture('dumpsys-api36.txt'), PKG);
    expect(posted).toEqual([
      {
        key: `0|${PKG}|3|null|10211`,
        s7id: 's7-0101',
        channel: 'appointments',
        postTimeMs: 1795150200250,
      },
    ]);
    expect(parseNotifications(fixture('dumpsys-api36.txt'), `${PKG}.noshow`)).toEqual([
      expect.objectContaining({ s7id: 's7-0999', postTimeMs: 1795150201000 }),
    ]);
  });

  it('an empty or unrelated dump gives nothing', () => {
    expect(parseNotifications('', PKG)).toEqual([]);
    expect(parseNotifications('Current Notification Manager state:\n', PKG)).toEqual([]);
  });
});

describe('createWatcher', () => {
  it('records each s7id once, even when it is still in the tray on later polls or replaced under the same key', async () => {
    const adb = createFakeAdb();
    const clock = fakeClock('2026-11-20T08:00:00.000Z');
    let dump = fixture('dumpsys-api33.txt');
    adb.answer(/dumpsys notification --noredact/, () => dump);
    const watcher = createWatcher({
      dev: device(adb, 'emulator-5554'),
      pkg: PKG,
      nowMs: clock.nowMs,
    });

    const first = await watcher.poll();
    expect(first.map((r) => r.s7id)).toEqual(['s7-0001', 's7-0002']);
    expect(first[0]).toMatchObject({ serial: 'emulator-5554', seenAtMs: clock.nowMs() });

    clock.advance(1000);
    expect(await watcher.poll()).toEqual([]);

    // A collapsed message replaces the notification under the same key with a new s7id.
    dump = dump.replace('tickerText=s7-0001', 'tickerText=s7-0004');
    clock.advance(1000);
    expect((await watcher.poll()).map((r) => r.s7id)).toEqual(['s7-0004']);
    expect(watcher.records().map((r) => r.s7id)).toEqual(['s7-0001', 's7-0002', 's7-0004']);
    expect(
      adb.calls.every((c) => c === '-s emulator-5554 shell dumpsys notification --noredact'),
    ).toBe(true);
  });
});
