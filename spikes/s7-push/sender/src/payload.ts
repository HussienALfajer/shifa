// FCM HTTP v1 message builder (criterion 2, MSG-27, MSG-29). Appointment events are visible
// high-priority notifications on the "appointments" channel, collapsed per appointment, with a
// TTL that ends at the appointment; `sync` is data-only at normal priority. Texts are synthetic
// and carry no diagnosis or specialty (ADR-0023).
import { type Kind } from '@shifa-spike/s7-receiver';

/** FCM keeps a message at most 28 days. */
export const MAX_TTL_SECONDS = 28 * 24 * 3600;
const LABEL_PATTERN = /^[a-zA-Z0-9-_.~%]{1,50}$/;

export interface PayloadInput {
  kind: Kind;
  appointmentId: string;
  appointmentAt: Date;
  token: string;
  s7id: string;
  now: Date;
  /** Default true; `--no-collapse` sends every message on its own (criterion 6). */
  collapse?: boolean;
  /** Overrides the TTL end (default: the appointment time). */
  ttlTo?: Date;
}

export interface MessageData {
  s7id: string;
  sentAt: string;
  appointmentId: string;
  kind: Kind;
}

export interface FcmMessage {
  token: string;
  notification?: { title: string; body: string };
  android: {
    priority: 'HIGH' | 'NORMAL';
    ttl: string;
    collapse_key?: string;
    notification?: { channel_id: string };
  };
  fcm_options: { analytics_label: string };
  data: MessageData;
}

export const labelFor = (kind: Kind): string => `s7_${kind}`;

/** FCM's label rule plus the spike's `s7_` prefix (its data can be told apart and deleted). */
export const validateLabel = (label: string): boolean =>
  LABEL_PATTERN.test(label) && label.startsWith('s7_');

const clock = new Intl.DateTimeFormat('ar-SY', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Damascus',
});

/** Title and body for a kind; the inbox record carries the same text as the push. */
export function textFor(kind: Kind, appointmentAt: Date): { title: string; body: string } {
  switch (kind) {
    case 'reminder':
      return {
        title: 'تذكير بموعدك',
        body: `موعدك في عيادة تجريبية الساعة ${clock.format(appointmentAt)}`,
      };
    case 'turn-near':
      return { title: 'دورك قريب', body: 'بقي ٣ مراجعين قبلك في عيادة تجريبية' };
    case 'call-in':
      return { title: 'تفضّل إلى العيادة ٢', body: 'حان دورك في عيادة تجريبية' };
    case 'sync':
      return { title: 'تحديث', body: '' };
  }
}

export function ttlSeconds(end: Date, now: Date): number {
  const seconds = Math.floor((end.getTime() - now.getTime()) / 1000);
  return Math.min(MAX_TTL_SECONDS, Math.max(0, seconds));
}

export function buildMessage(input: PayloadInput): { message: FcmMessage } {
  const label = labelFor(input.kind);
  if (!validateLabel(label)) throw new Error(`invalid analytics label ${label}`);
  const ttl = `${String(ttlSeconds(input.ttlTo ?? input.appointmentAt, input.now))}s`;
  const data: MessageData = {
    s7id: input.s7id,
    sentAt: input.now.toISOString(),
    appointmentId: input.appointmentId,
    kind: input.kind,
  };
  const fcm_options = { analytics_label: label };

  if (input.kind === 'sync') {
    return {
      message: { token: input.token, android: { priority: 'NORMAL', ttl }, fcm_options, data },
    };
  }
  const android: FcmMessage['android'] = {
    priority: 'HIGH',
    ttl,
    notification: { channel_id: 'appointments' },
  };
  if (input.collapse ?? true) android.collapse_key = `appt_${input.appointmentId}`;
  return {
    message: {
      token: input.token,
      notification: textFor(input.kind, input.appointmentAt),
      android,
      fcm_options,
      data,
    },
  };
}
