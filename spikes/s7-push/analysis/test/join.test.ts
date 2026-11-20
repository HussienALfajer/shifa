// A graded run where every send expired offline (offline-ttl-expire on a real emulator): nothing
// was due on the tray, so the run must not count as 0% on time.
import { describe, expect, it } from 'vitest';
import { joinRun } from '../src/join.ts';
import { type Run } from '../src/types.ts';

const send = (i: number) => ({
  s7id: `s7-e${String(i)}`,
  installId: 'i1',
  kind: 'reminder',
  label: 's7_reminder',
  appointmentId: 'appt',
  collapse: true,
  ttl: '60s',
  sentAt: new Date(Date.UTC(2026, 10, 20, 5, 0, i)).toISOString(),
  httpStatus: 200,
  attempts: 1,
  durationMs: 300,
});

describe('joinRun', () => {
  it('scores a run with every send expired as 100%, not 0%', () => {
    const sends = [send(0), send(1)];
    const run = {
      dir: 'expired-only',
      meta: {
        kind: 'state',
        state: 'offline-ttl-expire',
        app: 'compliant',
        serial: 'emulator-5554',
        sdk: 33,
        grading: 'graded',
        networkBackAt: '2026-11-20T05:10:00.000Z',
        skew: { beforeMs: 0, afterMs: 0, skewMs: 0, driftMs: 0, flagged: false },
      },
      sends,
      shown: [],
      receipts: [],
      inbox: sends.map((s) => ({ s7id: s.s7id })),
    } as unknown as Run;
    expect(joinRun(run)).toMatchObject({ expected: 0, expired: 2, within60Pct: 100, lost: [] });
  });
});
