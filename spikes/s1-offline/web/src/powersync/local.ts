// Optimistic local writes of the PowerSync engine: the same effects as the outbox engine's, written
// into the synced tables. They enter PowerSync's upload queue, which the server ignores; the next
// checkpoint replaces them with server state (remaps, conflicts and refusals included).
import type { Transaction } from '@powersync/web';
import type { Command } from '../engine.ts';

export async function applyLocally(tx: Transaction, c: Command): Promise<void> {
  switch (c.type) {
    case 'ticket.issue':
      await tx.execute(
        `INSERT INTO queue_ticket (id, practitioner_id, shift_date, provisional_number, device_id, status, walk_in_label)
         VALUES (?, ?, ?, ?, ?, 'waiting', ?)`,
        [
          c.payload.ticketId,
          c.payload.practitionerId,
          c.payload.shiftDate,
          c.payload.provisionalNumber,
          c.deviceId,
          c.payload.walkInLabel,
        ],
      );
      return;
    case 'ticket.status':
      await tx.execute('UPDATE queue_ticket SET status = ? WHERE id = ?', [
        c.payload.status,
        c.payload.ticketId,
      ]);
      return;
    case 'appointment.book':
      await tx.execute(
        `INSERT INTO appointment (id, practitioner_id, patient_id, starts_at, ends_at, status)
         VALUES (?, ?, ?, ?, ?, 'booked')`,
        [
          c.payload.appointmentId,
          c.payload.practitionerId,
          c.payload.patientId ?? null,
          c.payload.start,
          c.payload.end,
        ],
      );
      return;
    case 'appointment.cancel':
      await tx.execute(`UPDATE appointment SET status = 'cancelled' WHERE id = ?`, [
        c.payload.appointmentId,
      ]);
      return;
    case 'cash.open':
      await tx.execute('INSERT INTO cash_session (id, rates, closed_at) VALUES (?, ?, NULL)', [
        c.payload.sessionId,
        JSON.stringify(c.payload.rates),
      ]);
      return;
    case 'cash.close':
      await tx.execute('UPDATE cash_session SET closed_at = ? WHERE id = ?', [
        c.clientTime,
        c.payload.sessionId,
      ]);
      return;
    case 'cash.move':
      await tx.execute(
        `INSERT INTO cash_movement (id, session_id, type, currency, amount_minor, rate_used, offline, refund_of, device_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.payload.movementId,
          c.payload.sessionId,
          c.payload.type,
          c.payload.currency,
          c.payload.amountMinor,
          c.payload.rateUsed,
          c.offline ? 1 : 0,
          c.payload.refundOf ?? null,
          c.deviceId,
        ],
      );
      return;
  }
}
