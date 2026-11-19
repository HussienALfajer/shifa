// Criterion 2 (MSG-27, MSG-29): payload rules for appointment events and silent sync.
import { describe, expect, it } from 'vitest';
import { buildMessage, labelFor, validateLabel } from '../src/payload.ts';

const NOW = new Date('2026-11-19T08:00:00.000Z');
const base = {
  appointmentId: 'appt-7',
  appointmentAt: new Date('2026-11-19T10:00:00.000Z'),
  token: 'fake-token',
  s7id: 's7-0001',
  now: NOW,
};

// Words that would carry medical meaning; push bodies must never hold them (ADR-0023).
const FORBIDDEN = ['تشخيص', 'اختصاص', 'أسنان', 'قلب', 'سكري', 'diagnosis', 'specialty'];

describe('appointment events', () => {
  for (const kind of ['reminder', 'turn-near', 'call-in'] as const) {
    it(`${kind}: visible, HIGH, channel appointments, collapse per appointment, TTL to the appointment, label`, () => {
      const { message } = buildMessage({ ...base, kind });
      expect(message.token).toBe('fake-token');
      expect(Object.keys(message.notification ?? {}).sort()).toEqual(['body', 'title']);
      expect(message.notification?.title).toMatch(/\S/);
      expect(message.android.priority).toBe('HIGH');
      expect(message.android.notification?.channel_id).toBe('appointments');
      expect(message.android.collapse_key).toBe('appt_appt-7');
      expect(message.android.ttl).toBe('7200s');
      expect(message.fcm_options.analytics_label).toBe(`s7_${kind}`);
      expect(message.data).toEqual({
        s7id: 's7-0001',
        sentAt: NOW.toISOString(),
        appointmentId: 'appt-7',
        kind,
      });
      const text = JSON.stringify(message.notification);
      for (const word of FORBIDDEN) expect(text).not.toContain(word);
    });
  }

  it('TTL is 0 s once the appointment has passed, and capped at 28 days', () => {
    const past = buildMessage({ ...base, kind: 'reminder', appointmentAt: new Date(0) });
    expect(past.message.android.ttl).toBe('0s');
    const far = buildMessage({
      ...base,
      kind: 'reminder',
      appointmentAt: new Date('2027-06-01T00:00:00.000Z'),
    });
    expect(far.message.android.ttl).toBe(`${28 * 24 * 3600}s`);
  });

  it('--ttl-to overrides the TTL end; --no-collapse drops the key', () => {
    const { message } = buildMessage({
      ...base,
      kind: 'turn-near',
      collapse: false,
      ttlTo: new Date('2026-11-19T08:10:00.000Z'),
    });
    expect(message.android.ttl).toBe('600s');
    expect('collapse_key' in message.android).toBe(false);
  });
});

describe('silent sync', () => {
  it('is data-only with NORMAL priority', () => {
    const { message } = buildMessage({ ...base, kind: 'sync' });
    expect(message.notification).toBeUndefined();
    expect(message.android.notification).toBeUndefined();
    expect(message.android.priority).toBe('NORMAL');
    expect(message.fcm_options.analytics_label).toBe('s7_sync');
    expect(message.data.kind).toBe('sync');
  });
});

describe('labels', () => {
  it('accepts only FCM-valid labels that start with s7_', () => {
    expect(labelFor('call-in')).toBe('s7_call-in');
    expect(validateLabel('s7_reminder')).toBe(true);
    expect(validateLabel('reminder')).toBe(false);
    expect(validateLabel('s7_has space')).toBe(false);
    expect(validateLabel(`s7_${'a'.repeat(48)}`)).toBe(false);
  });
});
