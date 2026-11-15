// Command contract shared by both engines (local to the spike, not in packages/contracts).
// A command is one offline-capable write; its `id` is the client's idempotency key (SCH-13).
import { z } from 'zod';

export const CURRENCIES = ['SYP', 'TRY', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const TICKET_STATUSES = ['waiting', 'called', 'in_service', 'done', 'no_show'] as const;
export const MOVEMENT_TYPES = ['sale', 'refund', 'expense', 'deposit', 'float_adjust'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
/** OD-29: the only cash movements allowed while offline. */
export const OFFLINE_MOVEMENT_TYPES: readonly MovementType[] = ['sale', 'refund'];

const uuid = z.uuid();
/** Positive integer minor units as a decimal string (JSON has no bigint). */
const minor = z.string().regex(/^[1-9]\d{0,17}$/);
/** Exchange rate as a positive decimal string, never a float. */
const rate = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,8})?$/)
  .refine((v) => Number(v) > 0);
const day = z.iso.date();

const payloads = {
  'ticket.issue': z.object({
    ticketId: uuid,
    practitionerId: uuid,
    shiftDate: day,
    provisionalNumber: z.int().positive().max(100_000),
    walkInLabel: z.string().min(1).max(40),
  }),
  'ticket.status': z.object({ ticketId: uuid, status: z.enum(TICKET_STATUSES) }),
  'appointment.book': z.object({
    appointmentId: uuid,
    practitionerId: uuid,
    patientId: uuid.optional(),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
  }),
  'appointment.cancel': z.object({ appointmentId: uuid }),
  'cash.open': z.object({ sessionId: uuid, rates: z.record(z.enum(CURRENCIES), rate) }),
  'cash.close': z.object({ sessionId: uuid }),
  'cash.move': z.object({
    movementId: uuid,
    sessionId: uuid,
    type: z.enum(MOVEMENT_TYPES),
    currency: z.enum(CURRENCIES),
    amountMinor: minor,
    rateUsed: rate,
    refundOf: uuid.optional(),
  }),
} as const;

export type CommandType = keyof typeof payloads;
export const COMMAND_TYPES = Object.keys(payloads) as CommandType[];
export type Payload<T extends CommandType> = z.infer<(typeof payloads)[T]>;

const envelope = z.object({
  id: uuid,
  deviceId: z.string().regex(/^[A-Za-z0-9-]{1,40}$/),
  /** True when the device made the command while offline (decides the OD-29 cash rules). */
  offline: z.boolean(),
  // Information only (the server times commands on receipt); bounded so PostgreSQL accepts it.
  clientTime: z.iso.datetime({ offset: true }).refine((v) => Date.parse(v) > Date.UTC(2000, 0, 1)),
});

const variant = <T extends CommandType>(type: T) =>
  envelope.extend({ type: z.literal(type), payload: payloads[type] });

export const Command = z.discriminatedUnion('type', [
  variant('ticket.issue'),
  variant('ticket.status'),
  variant('appointment.book'),
  variant('appointment.cancel'),
  variant('cash.open'),
  variant('cash.close'),
  variant('cash.move'),
]);
export type Command = {
  [T in CommandType]: z.infer<typeof envelope> & { type: T; payload: Payload<T> };
}[CommandType];

/** Only the envelope; used to answer a malformed command with a `refused` result by its id. */
export const CommandEnvelope = z.object({ id: uuid }).loose();

export const MAX_BATCH = 200;
export const CommandBatch = z.object({ commands: z.array(z.unknown()).min(1).max(MAX_BATCH) });

export type CommandStatus = 'applied' | 'conflict' | 'refused';
export interface CommandResult {
  id: string;
  status: CommandStatus;
  remap?: { ticketId: string; provisional: number; real: number };
  conflict?: { code: string; messageAr: string };
  serverTime: string;
}
