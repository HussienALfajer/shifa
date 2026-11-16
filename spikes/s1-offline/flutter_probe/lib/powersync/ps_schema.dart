// Local schema of the PowerSync engine. Synced tables mirror the patient
// sync streams (`patient_appointments`, `patient_tickets`, `device_results`);
// `outbox_command` is insert-only (each insert is one queued command,
// uploaded through the connector to the shared command handler);
// `pending_cancel` is local-only (what the screen shows cancelled until the
// server's answer arrives).
import 'package:powersync/powersync.dart';

const psSchema = Schema([
  Table('appointment', [
    Column.text('practitioner_id'),
    Column.text('patient_id'),
    Column.text('starts_at'),
    Column.text('ends_at'),
    Column.text('status'),
  ]),
  Table('queue_ticket', [
    Column.text('practitioner_id'),
    Column.text('shift_date'),
    Column.integer('provisional_number'),
    Column.integer('real_number'),
    Column.text('status'),
    Column.text('walk_in_label'),
  ]),
  Table('offline_command', [
    Column.text('device_id'),
    Column.text('type'),
    Column.text('result'),
  ]),
  Table.insertOnly('outbox_command', [
    Column.text('type'),
    Column.text('payload'),
    Column.text('device_id'),
    Column.integer('offline'),
    Column.text('client_time'),
  ]),
  Table.localOnly('pending_cancel', [Column.text('appointment_id')]),
]);

/// Local view names behind PowerSync's internal tables, for drift's updates.
String viewOf(String table) =>
    table.replaceFirst('ps_data_local__', '').replaceFirst('ps_data__', '');
