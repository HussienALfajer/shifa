// Server rows (snake_case, as /sync/pull and PowerSync deliver them) → the prototype's rows.
import type { AppointmentRow, CashSessionRow, MovementRow, TicketRow } from './engine.ts';

type Raw = Record<string, unknown>;

const str = (v: unknown): string =>
  typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint'
      ? String(v)
      : '';
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));
const opt = <K extends string>(k: K, v: unknown): Partial<Record<K, string>> =>
  v === null || v === undefined || v === '' ? {} : ({ [k]: str(v) } as Record<K, string>);
/** Server timestamps come as text in PostgreSQL's or ISO format; normalise to ISO. */
const iso = (v: unknown): string => {
  // "2026-11-16 14:00:00+00" (PostgreSQL text) → "2026-11-16T14:00:00+00:00" (parseable ISO).
  const text = str(v)
    .replace(' ', 'T')
    .replace(/([+-]\d{2})$/, '$1:00');
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
};

export const toTicket = (r: Raw): TicketRow => ({
  id: str(r['id']),
  practitionerId: str(r['practitioner_id']),
  shiftDate: str(r['shift_date']).slice(0, 10),
  provisionalNumber: num(r['provisional_number']),
  deviceId: str(r['device_id']),
  // An optimistic local row (PowerSync) has no real number yet.
  ...(r['real_number'] === null || r['real_number'] === undefined
    ? {}
    : { realNumber: num(r['real_number']) }),
  status: str(r['status']),
  walkInLabel: str(r['walk_in_label']),
});

export const toAppointment = (r: Raw): AppointmentRow => ({
  id: str(r['id']),
  practitionerId: str(r['practitioner_id']),
  ...opt('patientId', r['patient_id']),
  start: iso(r['start'] ?? r['starts_at']),
  end: iso(r['end'] ?? r['ends_at']),
  status: str(r['status']),
});

export const toSession = (r: Raw): CashSessionRow => ({
  id: str(r['id']),
  rates: (typeof r['rates'] === 'string' ? JSON.parse(r['rates']) : r['rates']) as Record<
    string,
    string
  >,
  closed: r['closed_at'] !== null && r['closed_at'] !== undefined && r['closed_at'] !== '',
});

export const toMovement = (r: Raw): MovementRow => ({
  id: str(r['id']),
  sessionId: str(r['session_id']),
  type: str(r['type']),
  currency: str(r['currency']),
  amountMinor: str(r['amount_minor']),
  rateUsed: str(r['rate_used']),
  offline: r['offline'] === true || r['offline'] === 1 || r['offline'] === 'true',
  ...opt('refundOf', r['refund_of']),
});
