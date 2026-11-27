// Support grants as both sides read them (A-02 criteria 11–13, 26): the columns every role may read
// (never the hand-off hash), the view of the contract, and the hand-off token and URL (ADR-0050).
// An open grant is one not ended whose expiry is still ahead by the API's clock; an expired grant
// not yet closed in the database reads as ended by `expiry` at its expiry.
import { createHash, randomBytes } from 'node:crypto';
import type { SupportGrantView } from '@shifa/contracts';
import { supportAccessGrant } from '@shifa/db';

/** A hand-off is valid for 2 minutes (ADR-0050). */
export const HANDOFF_TTL_MS = 2 * 60_000;

export const grantColumns = {
  id: supportAccessGrant.id,
  tenantId: supportAccessGrant.tenantId,
  adminUserId: supportAccessGrant.adminUserId,
  adminName: supportAccessGrant.adminName,
  reason: supportAccessGrant.reason,
  openedAt: supportAccessGrant.openedAt,
  expiresAt: supportAccessGrant.expiresAt,
  endedAt: supportAccessGrant.endedAt,
  endedBy: supportAccessGrant.endedBy,
  endedByName: supportAccessGrant.endedByName,
  endReason: supportAccessGrant.endReason,
};

export type GrantRow = {
  [K in keyof typeof grantColumns]: (typeof supportAccessGrant.$inferSelect)[K];
};

export function isOpen(row: GrantRow, now: Date): boolean {
  return row.endedAt === null && row.expiresAt > now;
}

export function grantView(row: GrantRow, now: Date): SupportGrantView {
  const expired = row.endedAt === null && row.expiresAt <= now;
  return {
    id: row.id,
    adminName: row.adminName,
    reason: row.reason,
    startedAt: row.openedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? (expired ? row.expiresAt.toISOString() : null),
    endedBy: row.endReason ?? (expired ? 'expiry' : null),
    endedByName: row.endedByName,
  };
}

/** 256 random bits as base64url (43 characters); only the SHA-256 is stored. */
export function newHandoffToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}

/** Clinic web's support page with the token in the fragment: it reaches no server log. */
export function handoffUrl(clinicWebUrl: string, token: string): string {
  return `${clinicWebUrl.replace(/\/+$/, '')}/support#${token}`;
}
