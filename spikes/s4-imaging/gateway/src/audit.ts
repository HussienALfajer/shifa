// One audit row per allowed request (IMG-25), written before the response is sent: if the row
// cannot be written, the request fails (503) rather than going unaudited.
import type pg from 'pg';
import type { Action } from './routes.ts';

export interface AuditEntry {
  actor: string;
  tenant: string;
  studyUid: string | null;
  action: Action;
  routeClass: string;
  status: number;
}

export interface AuditLog {
  write(entry: AuditEntry): Promise<void>;
  close(): Promise<void>;
}

export function createAuditLog(pool: pg.Pool): AuditLog {
  return {
    write: async (e) => {
      await pool.query(
        'insert into s4.audit (actor, tenant_id, study_uid, action, route_class, status) values ($1, $2, $3, $4, $5, $6)',
        [e.actor, e.tenant, e.studyUid, e.action, e.routeClass, e.status],
      );
    },
    close: () => pool.end(),
  };
}

/** The study UID from a STOW-RS response (Retrieve URL, 0008,1190), or null. */
export function stowStudyUid(body: string): string | null {
  try {
    const json = JSON.parse(body) as Record<string, { Value?: string[] } | undefined>;
    const url = json['00081190']?.Value?.[0] ?? '';
    return /\/studies\/([0-9.]+)$/.exec(url)?.[1] ?? null;
  } catch {
    return null;
  }
}
