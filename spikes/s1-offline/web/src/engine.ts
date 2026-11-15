// What the reception prototype needs from a sync engine. Two implementations: the custom outbox
// (src/outbox/) and PowerSync (src/powersync/); a build flag picks one.
import type { Command, CommandResult } from '@shifa-spike/s1-server/commands';

export type { Command, CommandResult };

export interface Session {
  token: string;
  deviceId: string;
  tenantId: string;
  branchId: string;
}

export type SyncState = 'online' | 'offline' | 'needs-login';

export interface SyncStatus {
  state: SyncState;
  /** Epoch ms of the first failed contact in the current outage (SCH-33). */
  offlineSince?: number;
}

export interface TicketRow {
  id: string;
  practitionerId: string;
  shiftDate: string;
  provisionalNumber: number;
  deviceId: string;
  /** Undefined until the server assigned it (SCH-32). */
  realNumber?: number;
  status: string;
  walkInLabel: string;
}

export interface AppointmentRow {
  id: string;
  practitionerId: string;
  patientId?: string;
  start: string;
  end: string;
  status: string;
}

export interface CashSessionRow {
  id: string;
  rates: Record<string, string>;
  closed: boolean;
}

export interface MovementRow {
  id: string;
  sessionId: string;
  type: string;
  currency: string;
  amountMinor: string;
  rateUsed: string;
  offline: boolean;
  refundOf?: string;
}

export interface Today {
  tickets: TicketRow[];
  appointments: AppointmentRow[];
  sessions: CashSessionRow[];
  movements: MovementRow[];
}

export type SyncEvent =
  | { kind: 'remap'; commandId: string; ticketId: string; provisional: number; real: number }
  | { kind: 'conflict' | 'refused'; commandId: string; code: string; messageAr: string };

export interface SyncEngine {
  /** Opens the local store for this session and starts background sync. */
  start(session: Session): Promise<void>;
  /** Stores the command locally (it survives a reload) and applies it optimistically. */
  enqueue(command: Command): Promise<void>;
  /** One upload + download round; resolves (never rejects) whatever the network does. */
  sync(): Promise<void>;
  today(): Promise<Today>;
  pendingCount(): Promise<number>;
  status(): SyncStatus;
  onEvent(listener: (event: SyncEvent) => void): () => void;
  /** Every remap, conflict and refusal so far (kept locally). */
  events(): Promise<SyncEvent[]>;
  stop(): void;
  /** Logout: deletes the local store. */
  wipe(): Promise<void>;
}
