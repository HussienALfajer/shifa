// Local SQLite schema of the PowerSync engine. Synced tables mirror the sync streams' columns;
// `outbox_command` is insert-only (each insert is one queued command, uploaded through the
// connector); `pending_command` is local-only (what the banner counts).
import { column, Schema, Table } from '@powersync/web';

export const schema = new Schema({
  queue_ticket: new Table({
    practitioner_id: column.text,
    shift_date: column.text,
    provisional_number: column.integer,
    device_id: column.text,
    real_number: column.integer,
    status: column.text,
    walk_in_label: column.text,
  }),
  appointment: new Table({
    practitioner_id: column.text,
    patient_id: column.text,
    starts_at: column.text,
    ends_at: column.text,
    status: column.text,
  }),
  cash_session: new Table({ rates: column.text, closed_at: column.text }),
  cash_movement: new Table({
    session_id: column.text,
    type: column.text,
    currency: column.text,
    amount_minor: column.text,
    rate_used: column.text,
    offline: column.integer,
    refund_of: column.text,
    device_id: column.text,
  }),
  offline_command: new Table({ device_id: column.text, type: column.text, result: column.text }),
  outbox_command: new Table(
    {
      type: column.text,
      payload: column.text,
      device_id: column.text,
      offline: column.integer,
      client_time: column.text,
    },
    { insertOnly: true },
  ),
  pending_command: new Table({ queued_at: column.text }, { localOnly: true }),
});
