// The criterion-6 script: two devices of one branch offline together for 2 simulated hours —
// 40 walk-ins, 60 status changes, 50 sales and 5 refunds in SYP/TRY/USD, 2 overlapping bookings —
// and the checks after reconnecting (zero lost, zero duplicated, every remap and conflict shown,
// cash totals per currency = sum of commands).
import { expect } from '@playwright/test';
import type { Report } from '@shifa-spike/s1-server';
import type { Currency, Device } from './device.ts';
import { serverReport, totals } from './report.ts';

export interface Expected {
  commands: number;
  conflicts: number;
  tickets: number;
  movements: number;
  booked: number;
  cash: Record<Currency, bigint>;
}

const CURRENCY: Currency[] = ['SYP', 'TRY', 'USD'];
/** ~80 rounds × 90 s ≈ 2 simulated hours. */
const STEP_MS = 90_000;

/** Opens the branch's cash session online (if none is open) and lets every device see it. */
export async function ensureSession(devices: Device[]): Promise<number> {
  const [first] = devices;
  if (!first) return 0;
  let issued = 0;
  if (await first.page.getByTestId('open-session').isVisible()) {
    await first.openSession();
    issued = 1;
  }
  for (const d of devices) {
    await d.waitSynced();
    await expect(d.page.getByTestId('cash-form')).toBeVisible();
  }
  return issued;
}

/**
 * Runs the outage script on two devices that are already offline. `slot` (HH:MM) is the time both
 * book with the same practitioner; specs use different slots so they do not collide.
 */
export async function outageScript(devices: [Device, Device], slot: string): Promise<Expected> {
  const cash: Record<Currency, bigint> = { SYP: 0n, TRY: 0n, USD: 0n };
  const perDevice: (() => Promise<void>)[][] = [];
  for (const [i, d] of devices.entries()) {
    const steps: (() => Promise<void>)[] = [];
    perDevice.push(steps);
    for (let n = 1; n <= 20; n += 1) steps.push(() => d.walkIn(n));
    for (let t = 0; t < 15; t += 1) {
      steps.push(() => d.setStatus(t, 'called'));
      steps.push(() => d.setStatus(t, 'done'));
    }
    for (let k = 0; k < 25; k += 1) {
      const currency = CURRENCY[k % 3] ?? 'SYP';
      const major = currency === 'SYP' ? 5_000 + k : 10 + k;
      cash[currency] += BigInt(major) * 100n;
      steps.push(() => d.sale(currency, `${String(major)}.00`));
    }
    // Refunds of 1.00 from the first sale (SYP) made on this device: 3 on one, 2 on the other.
    for (let r = 0; r < (i === 0 ? 3 : 2); r += 1) {
      cash.SYP -= 100n;
      steps.push(() => d.refund('1.00'));
    }
    steps.push(() => d.book(slot, true, 1));
  }
  // Interleave the two devices' actions over the outage, advancing both clocks each step.
  const rounds = Math.max(...perDevice.map((s) => s.length));
  for (let s = 0; s < rounds; s += 1) {
    for (const steps of perDevice) await steps[s]?.();
    for (const d of devices) await d.advance(STEP_MS);
  }
  const rest = 2 * 3600_000 - rounds * STEP_MS;
  for (const d of devices) if (rest > 0) await d.advance(rest);
  const commands = perDevice.reduce((n, s) => n + s.length, 0);
  return { commands, conflicts: 1, tickets: 40, movements: 55, booked: 1, cash };
}

export interface Outcome {
  report: Report;
  remapsShown: number[];
  conflictsShown: number;
}

/** Checks the server and both screens after the devices synced (criteria 6 and 8). */
export async function assertOutcome(
  devices: Device[],
  expected: Expected,
  extraCommands = 0,
): Promise<Outcome> {
  const ids = await Promise.all(devices.map((d) => d.deviceId()));
  const report = await serverReport(ids);
  const sum = totals(report);
  expect(sum.commands, 'commands received = issued (none lost, none duplicated)').toBe(
    expected.commands + extraCommands,
  );
  expect(sum.conflict, 'the double booking is a conflict').toBe(expected.conflicts);
  expect(sum.refused, 'nothing refused').toBe(0);
  expect(report.tickets.total, 'one ticket per walk-in').toBe(expected.tickets);
  expect(report.tickets.duplicateNumbers, 'no duplicate real number').toBe(0);
  expect(report.tickets.gaps, 'real numbers gap-free per shift').toBe(0);
  expect(report.movements, 'one movement per sale or refund').toBe(expected.movements);
  expect(report.appointmentsBooked).toBe(expected.booked);
  for (const c of CURRENCY) {
    expect(BigInt(report.cash[c] ?? '0'), `cash total ${c}`).toBe(expected.cash[c]);
  }
  const remapsShown = await Promise.all(devices.map((d) => d.events('remap')));
  for (const [i, d] of ids.entries()) {
    expect(remapsShown[i], `every remap shown on ${d}`).toBe(report.byDevice[d]?.remaps);
  }
  const conflictsShown = (await Promise.all(devices.map((d) => d.events('conflict')))).reduce(
    (a, b) => a + b,
    0,
  );
  expect(conflictsShown, 'the double booking shown to staff').toBe(expected.conflicts);
  for (const d of devices) expect(await d.pending(), 'pending count back to zero').toBe(0);
  return { report, remapsShown, conflictsShown };
}
