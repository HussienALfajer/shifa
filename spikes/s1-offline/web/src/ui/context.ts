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
  envelope(): Pick<Command, 'id' | 'deviceId' | 'offline' | 'clientTime'>;
  rerender(): void;
}
