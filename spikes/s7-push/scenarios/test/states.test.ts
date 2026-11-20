// Criteria 4–6: each state issues the expected `adb` (and emulator console) commands in order on
// the fake, and its teardown restores the emulator: Doze off, bucket active, network on,
// permission and channel back. Reboot waits for the device and never launches the app.
import { describe, expect, it } from 'vitest';
import { device } from '../src/adb.ts';
import { runState } from '../src/runner.ts';
import { STATES, type StateContext, type StateName } from '../src/states.ts';
import { createFakeAdb, fakeClock } from './fakes/adb.ts';

const PKG = 'dev.shifa.spike.s7push';
const SERIAL = 'emulator-5554';
const LAUNCH = `shell monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`;
const HOME = 'shell input keyevent KEYCODE_HOME';
const WAKE = 'shell input keyevent KEYCODE_WAKEUP';
const SLEEP = 'shell input keyevent KEYCODE_SLEEP';
const CHANNEL = `shell am start -a android.settings.CHANNEL_NOTIFICATION_SETTINGS --es android.provider.extra.APP_PACKAGE ${PKG} --es android.provider.extra.CHANNEL_ID appointments`;

function harness() {
  const adb = createFakeAdb();
  const clock = fakeClock('2026-11-20T09:00:00.000Z');
  const prompts: string[] = [];
  const ctx: StateContext = {
    dev: device(adb, SERIAL),
    pkg: PKG,
    sleep: clock.sleep,
    prompt: (text) => {
      prompts.push(text);
      return Promise.resolve();
    },
  };
  return { adb, ctx, prompts };
}

async function phases(name: StateName) {
  const { adb, ctx, prompts } = harness();
  const state = STATES[name];
  await state.setup(ctx);
  const setup = adb.callsFor(SERIAL);
  adb.clear();
  await state.between?.(ctx);
  const between = adb.callsFor(SERIAL);
  adb.clear();
  await state.teardown(ctx);
  const teardown = adb.callsFor(SERIAL);
  return { setup, between, teardown, prompts };
}

describe('state modules', () => {
  it('covers every state of criterion 4 plus the pending-limit runs of criterion 6', () => {
    expect(Object.keys(STATES).sort()).toEqual(
      [
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
      ].sort(),
    );
  });

  it('grades exactly the states where Android allows delivery (OD-52)', () => {
    const by = (g: string) =>
      Object.values(STATES)
        .filter((s) => s.grading === g)
        .map((s) => s.name)
        .sort();
    expect(by('excluded')).toEqual(
      ['bucket-restricted', 'channel-off', 'force-stopped', 'permission-denied'].sort(),
    );
    expect(by('recorded')).toEqual(['pending-limit', 'pending-limit-collapsed']);
    expect(STATES['force-stopped'].exclusion).toBe('force-stopped');
    expect(STATES['bucket-restricted'].exclusion).toBe('restricted');
    expect(STATES['permission-denied'].exclusion).toBe('permission-denied');
    expect(STATES['channel-off'].exclusion).toBe('channel-off');
  });

  it('every state defaults to 20 sends 30 s apart, except the 120-message pending-limit runs', () => {
    for (const s of Object.values(STATES)) {
      if (s.name.startsWith('pending-limit')) {
        expect(s.count).toBe(120);
        expect(s.send.collapse).toBe(s.name === 'pending-limit-collapsed');
      } else {
        expect([s.name, s.count, s.gapS]).toEqual([s.name, 20, 30]);
      }
    }
  });

  it('foreground and background', async () => {
    expect(await phases('foreground')).toMatchObject({
      setup: [WAKE, LAUNCH],
      teardown: [HOME],
    });
    expect(await phases('background')).toMatchObject({
      setup: [WAKE, LAUNCH, HOME],
      teardown: [],
    });
  });

  it('swiped from recents kills the process without the stopped flag', async () => {
    const p = await phases('swiped');
    expect(p.setup).toEqual([WAKE, LAUNCH, HOME, `shell am kill ${PKG}`]);
    expect(p.setup.join('\n')).not.toContain('force-stop');
  });

  it('screen off turns the screen back on in teardown', async () => {
    expect(await phases('screen-off')).toMatchObject({
      setup: [WAKE, LAUNCH, HOME, SLEEP],
      teardown: [WAKE],
    });
  });

  it('doze forces idle on battery, re-forces between sends and restores', async () => {
    expect(await phases('doze')).toEqual({
      setup: [
        WAKE,
        LAUNCH,
        HOME,
        'shell dumpsys battery unplug',
        SLEEP,
        'shell dumpsys deviceidle force-idle',
      ],
      between: ['shell dumpsys deviceidle force-idle'],
      teardown: ['shell dumpsys deviceidle unforce', 'shell dumpsys battery reset', WAKE],
      prompts: [],
    });
  });

  it('standby buckets rare and restricted end at bucket active', async () => {
    for (const bucket of ['rare', 'restricted'] as const) {
      const p = await phases(`bucket-${bucket}`);
      expect(p.setup).toEqual([
        WAKE,
        LAUNCH,
        HOME,
        'shell dumpsys battery unplug',
        `shell am set-standby-bucket ${PKG} ${bucket}`,
      ]);
      expect(p.between).toEqual([`shell am set-standby-bucket ${PKG} ${bucket}`]);
      expect(p.teardown).toEqual([
        `shell am set-standby-bucket ${PKG} active`,
        'shell dumpsys battery reset',
      ]);
    }
  });

  it('reboot waits for the device and boot, and never launches the app', async () => {
    const { adb, ctx } = harness();
    let polls = 0;
    adb.answer(/getprop sys\.boot_completed/, () => (++polls < 3 ? '\n' : '1\n'));
    await STATES.reboot.setup(ctx);
    await STATES.reboot.teardown(ctx);
    const calls = adb.callsFor(SERIAL);
    expect(calls.slice(0, 2)).toEqual(['reboot', 'wait-for-device']);
    expect(calls.filter((c) => c === 'shell getprop sys.boot_completed')).toHaveLength(3);
    expect(calls.join('\n')).not.toMatch(/monkey|am start/);
  });

  it('force-stopped stops the app; teardown opens it once to clear the stopped state', async () => {
    expect(await phases('force-stopped')).toMatchObject({
      setup: [HOME, `shell am force-stop ${PKG}`],
      teardown: [LAUNCH, HOME],
    });
  });

  it('offline states cut wifi and data and bring both back; TTL and collapse per variant', async () => {
    for (const name of [
      'offline-ttl-long',
      'offline-ttl-expire',
      'offline-ttl-expire-nocollapse',
      'pending-limit',
      'pending-limit-collapsed',
    ] as const) {
      const p = await phases(name);
      expect(p.setup).toEqual([
        WAKE,
        LAUNCH,
        HOME,
        'shell svc wifi disable',
        'shell svc data disable',
      ]);
      expect(p.teardown).toEqual(['shell svc wifi enable', 'shell svc data enable']);
      expect(STATES[name].network).toBe('offline');
    }
    expect(STATES['offline-ttl-long'].send).toEqual({ collapse: true, sameAppointment: true });
    expect(STATES['offline-ttl-expire'].send).toEqual({
      collapse: true,
      sameAppointment: true,
      ttlToOffsetS: 300,
    });
    expect(STATES['offline-ttl-expire-nocollapse'].send).toEqual({
      collapse: false,
      sameAppointment: true,
      ttlToOffsetS: 300,
    });
  });

  it('slow link sets the recorded console profile and restores full speed', async () => {
    expect(await phases('slow-link')).toMatchObject({
      setup: [WAKE, LAUNCH, HOME, 'emu network speed gsm', 'emu network delay edge'],
      teardown: ['emu network speed full', 'emu network delay none'],
    });
  });

  it('permission denied revokes POST_NOTIFICATIONS and grants it back', async () => {
    expect(await phases('permission-denied')).toMatchObject({
      setup: [HOME, `shell pm revoke ${PKG} android.permission.POST_NOTIFICATIONS`],
      teardown: [`shell pm grant ${PKG} android.permission.POST_NOTIFICATIONS`],
    });
    expect(STATES['permission-denied'].openBeforeReport).toBe(true);
  });

  it('channel off opens the channel settings and asks the owner, both ways', async () => {
    const p = await phases('channel-off');
    expect(p.setup).toEqual([CHANNEL, HOME]);
    expect(p.teardown).toEqual([CHANNEL, HOME]);
    expect(p.prompts).toHaveLength(2);
    expect(p.prompts[0]).toMatch(/off/);
    expect(p.prompts[1]).toMatch(/on/);
    expect(STATES['channel-off'].openBeforeReport).toBe(true);
  });
});

describe('runState', () => {
  it('measures skew, sets up, sends with between-steps, tears down, waits for late arrivals and records the run', async () => {
    const adb = createFakeAdb();
    const clock = fakeClock('2026-11-20T09:00:00.000Z');
    adb.answer(/shell date \+%s%N$/, () => `${String(clock.hostNs() + 120_000_000n)}\n`);
    const sends: { appointmentId: string; to: string; collapse?: boolean; ttlTo?: Date }[] = [];
    let n = 0;
    const record = await runState(
      {
        state: 'doze',
        serial: SERIAL,
        app: 'compliant',
        installId: 'inst-1',
        count: 3,
        gapS: 30,
        settleS: 60,
      },
      {
        adb,
        now: clock.now,
        hostNs: clock.hostNs,
        sleep: clock.sleep,
        prompt: () => Promise.resolve(),
        log: () => undefined,
        send: (req) => {
          sends.push(req);
          n += 1;
          return Promise.resolve([
            {
              s7id: `s7-${String(n)}`,
              installId: req.to,
              kind: req.kind,
              label: `s7_${req.kind}`,
              appointmentId: req.appointmentId,
              collapse: req.collapse ?? true,
              ttl: '7200s',
              sentAt: clock.now().toISOString(),
              httpStatus: 200,
              fcmName: `projects/p/messages/${String(n)}`,
              attempts: 1,
              durationMs: 5,
            },
          ]);
        },
        receiver: {
          receipts: () => Promise.resolve([]),
          inbox: () => Promise.resolve([]),
          device: () => Promise.resolve(null),
        },
      },
    );
    expect(sends.map((s) => s.to)).toEqual(['inst-1', 'inst-1', 'inst-1']);
    // Online states use one appointment per send, so collapse never hides a message.
    expect(new Set(sends.map((s) => s.appointmentId)).size).toBe(3);
    const calls = adb
      .callsFor(SERIAL)
      .filter((c) => !c.includes('dumpsys notification') && !c.includes('date'));
    expect(calls.filter((c) => c === 'shell dumpsys deviceidle force-idle')).toHaveLength(1 + 2);
    expect(calls.at(-1)).toBe(WAKE);
    expect(record.meta).toMatchObject({
      state: 'doze',
      serial: SERIAL,
      app: 'compliant',
      pkg: PKG,
      grading: 'graded',
      kind: 'state',
      skew: { beforeMs: 120, afterMs: 120, driftMs: 0, flagged: false },
    });
    expect(record.sends).toHaveLength(3);
    // 3 sends 30 s apart, then the 60 s settle window, all polled by the watcher.
    expect(
      Date.parse(record.meta.endedAt) - Date.parse(record.meta.startedAt),
    ).toBeGreaterThanOrEqual(150_000);
    expect(adb.calls.filter((c) => c.includes('dumpsys notification')).length).toBeGreaterThan(100);
  });

  it('a noshow run is recorded, never graded; offline runs record when the network came back', async () => {
    const adb = createFakeAdb();
    const clock = fakeClock('2026-11-20T09:00:00.000Z');
    adb.answer(/shell date \+%s%N$/, () => `${String(clock.hostNs())}\n`);
    const deps = {
      adb,
      now: clock.now,
      hostNs: clock.hostNs,
      sleep: clock.sleep,
      prompt: () => Promise.resolve(),
      log: () => undefined,
      send: () => Promise.resolve([]),
      receiver: {
        receipts: () => Promise.resolve([]),
        inbox: () => Promise.resolve([]),
        device: () => Promise.resolve(null),
      },
    };
    const noshow = await runState(
      {
        state: 'foreground',
        serial: SERIAL,
        app: 'noshow',
        installId: 'inst-2',
        count: 1,
        gapS: 1,
        settleS: 1,
      },
      deps,
    );
    expect(noshow.meta).toMatchObject({ pkg: `${PKG}.noshow`, grading: 'recorded' });
    const offline = await runState(
      {
        state: 'offline-ttl-expire',
        serial: SERIAL,
        app: 'compliant',
        installId: 'inst-1',
        count: 2,
        gapS: 30,
        settleS: 60,
      },
      deps,
    );
    expect(offline.meta.networkBackAt).toBeDefined();
    expect(Date.parse(offline.meta.networkBackAt ?? '')).toBeGreaterThan(
      Date.parse(offline.meta.startedAt),
    );
  });
});
