// The state matrix (criteria 4–6) as small modules of `adb` commands: setup before the first send,
// `between` before every later send, teardown after the last. Every teardown brings the emulator
// back to normal (Doze off, bucket active, network on, permission and channel back). Grading
// follows OD-52: `excluded` states are where Android does not deliver by design and must be
// detectable from the device state; `recorded` runs are measured but not graded.
import { type Device } from './adb.ts';

export interface StateContext {
  dev: Device;
  pkg: string;
  sleep: (ms: number) => Promise<void>;
  /** Asks the owner to do something on the emulator and waits for Enter. */
  prompt: (text: string) => Promise<void>;
}

export type Grading = 'graded' | 'excluded' | 'recorded';
export type Exclusion = 'force-stopped' | 'restricted' | 'permission-denied' | 'channel-off';

export interface SendPlan {
  collapse: boolean;
  /** All sends of the run go to one appointment (one collapse key); else one appointment each. */
  sameAppointment: boolean;
  /** TTL ends this many seconds after the run starts (default: the appointment time, +2 h). */
  ttlToOffsetS?: number;
}

export interface StateModule {
  name: StateName;
  grading: Grading;
  exclusion?: Exclusion;
  count: number;
  gapS: number;
  send: SendPlan;
  /** Network is cut in setup and restored in teardown; the run records when it came back. */
  network?: 'offline';
  /** Open the app once after the sends so it reports its device state before teardown. */
  openBeforeReport?: boolean;
  setup: (ctx: StateContext) => Promise<void>;
  between?: (ctx: StateContext) => Promise<void>;
  teardown: (ctx: StateContext) => Promise<void>;
}

export const STATE_NAMES = [
  'foreground',
  'background',
  'swiped',
  'screen-off',
  'doze',
  'bucket-rare',
  'bucket-restricted',
  'reboot',
  'force-stopped',
  'offline-ttl-long',
  'offline-ttl-expire',
  'offline-ttl-expire-nocollapse',
  'slow-link',
  'permission-denied',
  'channel-off',
  'pending-limit',
  'pending-limit-collapsed',
] as const;
export type StateName = (typeof STATE_NAMES)[number];

export const isStateName = (v: string): v is StateName =>
  (STATE_NAMES as readonly string[]).includes(v);

const key = (dev: Device, code: string) => dev.shell(`input keyevent KEYCODE_${code}`);
const launch = (c: StateContext) =>
  c.dev.shell(`monkey -p ${c.pkg} -c android.intent.category.LAUNCHER 1`);

/** Screen on, app opened once (so it is not in the stopped state), then sent home. */
async function openThenHome(c: StateContext) {
  await key(c.dev, 'WAKEUP');
  await launch(c);
  await key(c.dev, 'HOME');
}

const PERMISSION = 'android.permission.POST_NOTIFICATIONS';
const channelSettings = (c: StateContext) =>
  c.dev.shell(
    `am start -a android.settings.CHANNEL_NOTIFICATION_SETTINGS --es android.provider.extra.APP_PACKAGE ${c.pkg} --es android.provider.extra.CHANNEL_ID appointments`,
  );

const ONLINE: SendPlan = { collapse: true, sameAppointment: false };
const base = { count: 20, gapS: 30, send: ONLINE } as const;

const nothing = () => Promise.resolve();

function bucket(name: 'bucket-rare' | 'bucket-restricted', b: 'rare' | 'restricted'): StateModule {
  const set = (c: StateContext) => c.dev.shell(`am set-standby-bucket ${c.pkg} ${b}`);
  return {
    ...base,
    name,
    grading: b === 'rare' ? 'graded' : 'excluded',
    ...(b === 'restricted' ? { exclusion: 'restricted' as const } : {}),
    setup: async (c) => {
      await openThenHome(c);
      await c.dev.shell('dumpsys battery unplug');
      await set(c);
    },
    // Opening a notification can promote the app; keep it in the bucket.
    between: (c) => set(c).then(nothing),
    teardown: async (c) => {
      await c.dev.shell(`am set-standby-bucket ${c.pkg} active`);
      await c.dev.shell('dumpsys battery reset');
    },
  };
}

function offline(
  name: StateName,
  send: SendPlan,
  grading: Grading,
  count = 20,
  gapS = 30,
): StateModule {
  return {
    name,
    grading,
    count,
    gapS,
    send,
    network: 'offline',
    setup: async (c) => {
      await openThenHome(c);
      await c.dev.shell('svc wifi disable');
      await c.dev.shell('svc data disable');
    },
    teardown: async (c) => {
      await c.dev.shell('svc wifi enable');
      await c.dev.shell('svc data enable');
    },
  };
}

async function waitForBoot(c: StateContext) {
  await c.dev.waitForDevice();
  for (let i = 0; i < 300; i += 1) {
    if ((await c.dev.shell('getprop sys.boot_completed')).trim() === '1') return;
    await c.sleep(1000);
  }
  throw new Error(`${c.dev.serial} did not finish booting`);
}

const list: StateModule[] = [
  {
    ...base,
    name: 'foreground',
    grading: 'graded',
    setup: async (c) => {
      await key(c.dev, 'WAKEUP');
      await launch(c);
    },
    teardown: (c) => key(c.dev, 'HOME').then(nothing),
  },
  { ...base, name: 'background', grading: 'graded', setup: openThenHome, teardown: nothing },
  {
    // Swiping from recents ends the process without the stopped flag; `am kill` does the same
    // without screen coordinates.
    ...base,
    name: 'swiped',
    grading: 'graded',
    setup: async (c) => {
      await openThenHome(c);
      await c.dev.shell(`am kill ${c.pkg}`);
    },
    teardown: nothing,
  },
  {
    ...base,
    name: 'screen-off',
    grading: 'graded',
    setup: async (c) => {
      await openThenHome(c);
      await key(c.dev, 'SLEEP');
    },
    teardown: (c) => key(c.dev, 'WAKEUP').then(nothing),
  },
  {
    ...base,
    name: 'doze',
    grading: 'graded',
    setup: async (c) => {
      await openThenHome(c);
      await c.dev.shell('dumpsys battery unplug');
      await key(c.dev, 'SLEEP');
      await c.dev.shell('dumpsys deviceidle force-idle');
    },
    // A high-priority push lets the app out of Doze briefly; force it back before the next one.
    between: (c) => c.dev.shell('dumpsys deviceidle force-idle').then(nothing),
    teardown: async (c) => {
      await c.dev.shell('dumpsys deviceidle unforce');
      await c.dev.shell('dumpsys battery reset');
      await key(c.dev, 'WAKEUP');
    },
  },
  bucket('bucket-rare', 'rare'),
  bucket('bucket-restricted', 'restricted'),
  {
    // After a reboot the app is not opened: the first sends hit an app that has not run yet.
    ...base,
    name: 'reboot',
    grading: 'graded',
    setup: async (c) => {
      await c.dev.reboot();
      await waitForBoot(c);
    },
    teardown: nothing,
  },
  {
    ...base,
    name: 'force-stopped',
    grading: 'excluded',
    exclusion: 'force-stopped',
    setup: async (c) => {
      await key(c.dev, 'HOME');
      await c.dev.shell(`am force-stop ${c.pkg}`);
    },
    // Opening the app clears the stopped state.
    teardown: async (c) => {
      await launch(c);
      await key(c.dev, 'HOME');
    },
  },
  offline('offline-ttl-long', { collapse: true, sameAppointment: true }, 'graded'),
  offline(
    'offline-ttl-expire',
    { collapse: true, sameAppointment: true, ttlToOffsetS: 300 },
    'graded',
  ),
  offline(
    'offline-ttl-expire-nocollapse',
    { collapse: false, sameAppointment: true, ttlToOffsetS: 300 },
    'graded',
  ),
  {
    // Recorded profile: the emulator's `gsm` speed and `edge` delay, the closest built-in
    // profiles to a weak Syrian mobile link.
    ...base,
    name: 'slow-link',
    grading: 'graded',
    setup: async (c) => {
      await openThenHome(c);
      await c.dev.emu('network speed gsm');
      await c.dev.emu('network delay edge');
    },
    teardown: async (c) => {
      await c.dev.emu('network speed full');
      await c.dev.emu('network delay none');
    },
  },
  {
    ...base,
    name: 'permission-denied',
    grading: 'excluded',
    exclusion: 'permission-denied',
    openBeforeReport: true,
    setup: async (c) => {
      await key(c.dev, 'HOME');
      await c.dev.shell(`pm revoke ${c.pkg} ${PERMISSION}`);
    },
    teardown: (c) => c.dev.shell(`pm grant ${c.pkg} ${PERMISSION}`).then(nothing),
  },
  {
    // No shell command turns one channel off as the user would; the owner flips it in Settings.
    ...base,
    name: 'channel-off',
    grading: 'excluded',
    exclusion: 'channel-off',
    openBeforeReport: true,
    setup: async (c) => {
      await channelSettings(c);
      await c.prompt('Turn the "مواعيد" channel off on the emulator, then press Enter.');
      await key(c.dev, 'HOME');
    },
    teardown: async (c) => {
      await channelSettings(c);
      await c.prompt('Turn the "مواعيد" channel back on, then press Enter.');
      await key(c.dev, 'HOME');
    },
  },
  offline('pending-limit', { collapse: false, sameAppointment: false }, 'recorded', 120, 1),
  offline('pending-limit-collapsed', { collapse: true, sameAppointment: true }, 'recorded', 120, 1),
];

export const STATES = Object.fromEntries(list.map((s) => [s.name, s])) as Record<
  StateName,
  StateModule
>;
