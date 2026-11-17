// What every part of the service shares, and the session row with its derived states.
import type { Deps, Logger, MessagingConfig } from './config.ts';
import { type Client, type Db, rows } from './db.ts';

export interface Ctx {
  config: MessagingConfig;
  db: Db;
  deps: Deps;
  log: Logger;
  /** Asks the queue to run a tick for the session now or at `at` (no-op when queue is off). */
  kick(session: string, at?: number): Promise<void>;
}

export type Health = 'linked' | 'needs_qr' | 'paused' | 'down';

export interface SessionRow {
  name: string;
  container: string;
  clinic_id: string | null;
  role: 'clinic' | 'platform';
  time_zone: string;
  waha_status: string;
  gateway_down: boolean;
  paused_until: string | null;
  needs_admin_resume: boolean;
  health: Health;
  last_ok_at: string | null;
  not_seen_alerted: boolean;
  created_at: string;
}

export async function loadSession(
  client: Client,
  name: string,
  lock = false,
): Promise<SessionRow | undefined> {
  const sql = `select * from s5.session where name = $1${lock ? ' for update' : ''}`;
  return (await rows<SessionRow>(client, sql, [name]))[0];
}

/** Sending is allowed only on a WORKING session that is neither down nor paused (OD-46). */
export const sendable = (s: SessionRow) =>
  s.waha_status === 'WORKING' && !s.gateway_down && !s.needs_admin_resume;

/** The clinic-visible state (MSG-17); STARTING keeps the previous state. */
export function deriveHealth(s: SessionRow): Health {
  if (s.gateway_down || s.waha_status === 'FAILED' || s.waha_status === 'STOPPED') return 'down';
  if (
    ['SCAN_QR_CODE', 'PASSKEY_REQUIRED', 'PASSKEY_CONFIRMATION_REQUIRED'].includes(s.waha_status)
  ) {
    return 'needs_qr';
  }
  if (s.needs_admin_resume) return 'paused';
  if (s.waha_status === 'WORKING') return 'linked';
  return s.health;
}

export const ts = (ctx: Ctx, t = ctx.deps.now()) => new Date(t).toISOString();
