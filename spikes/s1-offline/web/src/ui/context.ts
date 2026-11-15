// What every screen section receives: the engine, the session and helpers to build commands.
import type { Command, Session, SyncEngine, Today } from '../engine.ts';

export interface StoredSession extends Session {
  username: string;
  practitioners: { id: string; label: string }[];
}

export interface Ctx {
  engine: SyncEngine;
  session: StoredSession;
  today: Today;
  /** True unless the last sync round reached the server (OD-29 decides on it). */
  offline(): boolean;
  /** Enqueues, tries a sync at once, then re-renders. */
  submit(command: Command): Promise<void>;
  /**
   * Online-only actions (OD-29: open/close the cash session, expense, deposit, float adjustment)
   * are never queued: sent straight to the server; returns an Arabic error, or undefined when
   * applied. A queued online-only command could otherwise sync hours later as "online".
   */
  sendNow(command: Command): Promise<string | undefined>;
  envelope(): Pick<Command, 'id' | 'deviceId' | 'offline' | 'clientTime'>;
  rerender(): void;
}
