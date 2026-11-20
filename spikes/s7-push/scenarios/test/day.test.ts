// Criterion 7: the one-day run sends one push every 15 minutes from 08:00 to 21:00 local time (53
// sends) to both emulators, forces Doze between sends, and logs a missed slot instead of sending
// it late.
import { describe, expect, it } from 'vitest';
import { daySlots, runDay } from '../src/day.ts';
import { createFakeAdb, fakeClock } from './fakes/adb.ts';

const SERIALS = ['emulator-5554', 'emulator-5556'];

describe('daySlots', () => {
  it('gives 53 local times from 08:00 to 21:00, 15 minutes apart', () => {
    const slots = daySlots(new Date(2026, 10, 21, 3, 0));
    expect(slots).toHaveLength(53);
    expect([slots[0]?.getHours(), slots[0]?.getMinutes()]).toEqual([8, 0]);
    expect([slots[1]?.getHours(), slots[1]?.getMinutes()]).toEqual([8, 15]);
    expect([slots.at(-1)?.getHours(), slots.at(-1)?.getMinutes()]).toEqual([21, 0]);
    expect(slots.every((s) => s.getDate() === 21)).toBe(true);
  });
});

function deps(clock: ReturnType<typeof fakeClock>, adb = createFakeAdb(), slowAt?: number) {
  adb.answer(/shell date \+%s%N$/, () => `${String(clock.hostNs())}\n`);
  const sent: { to: string; at: Date }[] = [];
  const logs: string[] = [];
  return {
    adb,
    sent,
    logs,
    deps: {
      adb,
      now: clock.now,
      hostNs: clock.hostNs,
      sleep: clock.sleep,
      log: (line: string) => {
        logs.push(line);
      },
      send: (req: { to: string }) => {
        sent.push({ to: req.to, at: clock.now() });
        // One send hangs for 20 minutes (say the link stalls).
        if (slowAt !== undefined && sent.length === slowAt) clock.advance(20 * 60_000);
        return Promise.resolve([]);
      },
      receiver: {
        receipts: () => Promise.resolve([]),
        inbox: () => Promise.resolve([]),
        device: () => Promise.resolve(null),
      },
    },
  };
}

const targets = [
  { serial: SERIALS[0] ?? '', installId: 'inst-33' },
  { serial: SERIALS[1] ?? '', installId: 'inst-36' },
];

describe('runDay', () => {
  it('sends to both emulators at every slot and forces Doze on both between sends', async () => {
    const clock = fakeClock(new Date(2026, 10, 21, 7, 55).toISOString());
    const h = deps(clock);
    const result = await runDay({ day: new Date(2026, 10, 21), targets }, h.deps);
    expect(h.sent).toHaveLength(53 * 2);
    expect(h.sent.filter((s) => s.to === 'inst-33')).toHaveLength(53);
    for (const s of h.sent) expect(s.at.getMinutes() % 15).toBe(0);
    expect(result.missed).toEqual([]);
    for (const serial of SERIALS) {
      const calls = h.adb.callsFor(serial);
      expect(calls.slice(0, 3)).toEqual([
        'shell dumpsys battery unplug',
        'shell input keyevent KEYCODE_SLEEP',
        'shell dumpsys deviceidle force-idle',
      ]);
      // Re-forced after each send, so 1 at the start + 53.
      expect(calls.filter((c) => c === 'shell dumpsys deviceidle force-idle')).toHaveLength(54);
      expect(calls.slice(-2)).toEqual([
        'shell dumpsys deviceidle unforce',
        'shell dumpsys battery reset',
      ]);
    }
    expect(result.records.map((r) => r.meta.kind)).toEqual(['day', 'day']);
    expect(result.records.map((r) => r.meta.serial)).toEqual(SERIALS);
  });

  it('a slot already passed by more than a minute is logged as missed, not sent late', async () => {
    const clock = fakeClock(new Date(2026, 10, 21, 7, 55).toISOString());
    // The 4th send (slot 08:15, second emulator) stalls 20 minutes: slot 08:30 is missed whole.
    const h = deps(clock, createFakeAdb(), 4);
    const result = await runDay({ day: new Date(2026, 10, 21), targets }, h.deps);
    const missed = result.missed.map((d) => [d.getHours(), d.getMinutes()]);
    expect(missed).toEqual([[8, 30]]);
    expect(h.logs.some((l) => l.includes('missed'))).toBe(true);
    expect(
      h.sent.some((s) => s.at.getHours() === 8 && s.at.getMinutes() > 30 && s.at.getMinutes() < 45),
    ).toBe(false);
    expect(h.sent).toHaveLength(52 * 2);
  });
});
