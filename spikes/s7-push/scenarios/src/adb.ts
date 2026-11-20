// `adb` behind a one-method interface (0.3-S7b) so tests run the scenario code on a recorded-command
// fake. The emulator console is reached through `adb emu`, so one tool covers both.
import { execFile } from 'node:child_process';

export interface Adb {
  /** Runs `adb <args>` and returns stdout. */
  exec: (args: readonly string[]) => Promise<string>;
}

export interface Device {
  readonly serial: string;
  shell: (cmd: string) => Promise<string>;
  /** An emulator console command, e.g. `network speed gsm`. */
  emu: (cmd: string) => Promise<string>;
  reboot: () => Promise<string>;
  waitForDevice: () => Promise<string>;
}

export function device(adb: Adb, serial: string): Device {
  return {
    serial,
    shell: (cmd) => adb.exec(['-s', serial, 'shell', cmd]),
    emu: (cmd) => adb.exec(['-s', serial, 'emu', cmd]),
    reboot: () => adb.exec(['-s', serial, 'reboot']),
    waitForDevice: () => adb.exec(['-s', serial, 'wait-for-device']),
  };
}

/** The real `adb` from PATH (or `ADB`), with a 2-minute cap per call. */
export function systemAdb(bin = process.env['ADB'] ?? 'adb'): Adb {
  return {
    exec: (args) =>
      new Promise((resolve, reject) => {
        execFile(
          bin,
          [...args],
          { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
          (error, stdout, stderr) => {
            if (error)
              reject(
                new Error(`adb ${args.join(' ')} failed: ${stderr.trim() || error.message.trim()}`),
              );
            else resolve(stdout);
          },
        );
      }),
  };
}
