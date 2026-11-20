// 0.3-S7b, criterion 4: the host-side watcher identifies a shown notification by its ticker text,
// which carries the send's s7id (the system UI does not display the ticker on Android 5+).
import { describe, expect, it } from 'vitest';
import { buildMessage } from '../src/payload.ts';

const base = {
  appointmentId: 'appt-7',
  appointmentAt: new Date('2026-11-19T10:00:00.000Z'),
  token: 'fake-token',
  s7id: 's7-0042',
  now: new Date('2026-11-19T08:00:00.000Z'),
};

describe('ticker', () => {
  it('visible appointment events carry the s7id as the notification ticker', () => {
    for (const kind of ['reminder', 'turn-near', 'call-in'] as const) {
      const { message } = buildMessage({ ...base, kind });
      expect(message.android.notification).toEqual({
        channel_id: 'appointments',
        ticker: 's7-0042',
      });
    }
  });

  it('silent sync has no notification and so no ticker', () => {
    expect(buildMessage({ ...base, kind: 'sync' }).message.android.notification).toBeUndefined();
  });
});
