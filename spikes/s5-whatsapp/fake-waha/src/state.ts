// The fake's in-memory state: sessions with WAHA's state machine
// (STOPPED → STARTING → SCAN_QR_CODE → WORKING, and FAILED/STOPPED), per-session send modes,
// the LID table, the call log and hung requests.
import type { Me, SessionStatus } from './events.ts';

export type SendMode = 'ok' | 'error463' | 'error475' | 'timeout' | 'hang';

export interface FakeSession {
  name: string;
  status: SessionStatus;
  statuses: { status: SessionStatus; timestamp: number }[];
  /** Linked once (the fake's stand-in for a scanned QR): start goes straight to WORKING. */
  paired: boolean;
  me: Me;
  sendMode: SendMode;
  lids: Map<string, string | null>;
}

export interface FakeCall {
  /** Wall-clock ms when the request arrived and when its response was sent. */
  at: number;
  endedAt: number;
  /** The fake's clock (tests may run a manual one). */
  clock: number;
  method: string;
  path: string;
  session?: string;
  chatId?: string;
  text?: string;
  /** Id returned by a successful sendText. */
  messageId?: string;
}

export class FakeState {
  readonly sessions = new Map<string, FakeSession>();
  readonly calls: FakeCall[] = [];
  readonly hung: (() => void)[] = [];
  down = false;
  private count = 0;

  constructor(readonly now: () => number) {}

  session(name: string): FakeSession | undefined {
    return this.sessions.get(name);
  }

  create(name: string, paired: boolean): FakeSession {
    const existing = this.sessions.get(name);
    if (existing) return existing;
    this.count++;
    // The fake's own (clinic or platform) number: a fixed test range, never a patient's.
    const me = { id: `9639900${String(this.count).padStart(5, '0')}@c.us`, pushName: name };
    const s: FakeSession = {
      name,
      status: 'STOPPED',
      statuses: [],
      paired,
      me,
      sendMode: 'ok',
      lids: new Map(),
    };
    this.sessions.set(name, s);
    this.setStatus(s, 'STOPPED');
    return s;
  }

  setStatus(s: FakeSession, status: SessionStatus): void {
    s.status = status;
    s.statuses = [...s.statuses, { status, timestamp: this.now() }].slice(-3);
  }

  start(s: FakeSession): void {
    this.setStatus(s, 'STARTING');
    this.setStatus(s, s.paired ? 'WORKING' : 'SCAN_QR_CODE');
  }
}
