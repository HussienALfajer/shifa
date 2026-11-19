// Shapes of a committed run directory (written by @shifa-spike/s7-scenarios) and of the analysis
// result. Kept here, not imported, so the analysis reads only files.

export type Grading = 'graded' | 'excluded' | 'recorded';
export type Exclusion = 'force-stopped' | 'restricted' | 'permission-denied' | 'channel-off';

export interface RunMeta {
  kind: 'state' | 'day';
  state: string;
  app: 'compliant' | 'noshow';
  serial: string;
  sdk: number | null;
  grading: Grading;
  exclusion?: Exclusion;
  networkBackAt?: string;
  startedAt: string;
  endedAt: string;
  skew: { beforeMs: number; afterMs: number; skewMs: number; driftMs: number; flagged: boolean };
  device?: { permission: string; channels: { appointments: string; general: string } };
}

export interface SendLine {
  s7id: string;
  appointmentId: string;
  collapse: boolean;
  ttl: string;
  sentAt: string;
  httpStatus: number | null;
}

export interface ShownLine {
  s7id: string;
  /** Emulator clock. */
  postTimeMs: number;
}

export interface ReceiptLine {
  s7id: string;
  /** Emulator clock. */
  receivedAt: string;
  appState: string;
  path: string;
}

export interface InboxLine {
  s7id: string;
}

export interface Run {
  dir: string;
  meta: RunMeta;
  sends: SendLine[];
  shown: ShownLine[];
  receipts: ReceiptLine[];
  inbox: InboxLine[];
}

export type Detectability =
  | 'permission in device state'
  | 'channel in device state'
  | 'last seen only'
  | 'not detectable';

export interface RunResult {
  run: string;
  state: string;
  app: 'compliant' | 'noshow';
  serial: string;
  sdk: number | null;
  kind: 'state' | 'day';
  grading: Grading;
  exclusion?: Exclusion;
  n: number;
  /** n minus collapsed and expired: the messages that should have been shown. */
  expected: number;
  shown: number;
  within60: number;
  within60Pct: number;
  p50S: number | null;
  p95S: number | null;
  maxS: number | null;
  collapsed: number;
  expired: number;
  inboxOnly: number;
  lost: string[];
  detectability?: Detectability;
  skewFlagged: boolean;
}

export interface Verdict {
  pass: boolean;
  reasons: string[];
}
