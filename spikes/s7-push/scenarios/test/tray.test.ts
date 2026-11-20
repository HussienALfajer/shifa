// Android drops a package's notifications past 50, so runs snooze the probe's old ones first.
import { describe, expect, it } from 'vitest';
import { device } from '../src/adb.ts';
import { clearTray } from '../src/watcher.ts';
import { createFakeAdb } from './fakes/adb.ts';

const SERIAL = 'emulator-5554';
const PKG = 'dev.shifa.spike.s7push';
const LIST = [
  `0|${PKG}|0|FCM-Notification:1|10175`,
  `0|${PKG}|0|null|10175`,
  `0|${PKG}.noshow|0|FCM-Notification:2|10176`,
  '0|com.android.systemui|7|null|10120',
  '',
].join('\r\n');

describe('clearTray', () => {
  it("snoozes only the package's own notifications, not the noshow twin or other apps", async () => {
    const adb = createFakeAdb();
    adb.answer(/cmd notification list$/, LIST);
    expect(await clearTray(device(adb, SERIAL), PKG)).toBe(2);
    expect(adb.callsFor(SERIAL).filter((c) => c.includes('snooze'))).toEqual([
      `shell cmd notification snooze --for 2592000000 '0|${PKG}|0|FCM-Notification:1|10175'`,
      `shell cmd notification snooze --for 2592000000 '0|${PKG}|0|null|10175'`,
    ]);
  });

  it('leaves the tray alone below the threshold', async () => {
    const adb = createFakeAdb();
    adb.answer(/cmd notification list$/, LIST);
    expect(await clearTray(device(adb, SERIAL), PKG, 40)).toBe(0);
    expect(adb.callsFor(SERIAL).some((c) => c.includes('snooze'))).toBe(false);
  });
});
