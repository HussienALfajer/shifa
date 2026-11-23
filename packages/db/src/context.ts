// The `app.*` settings every policy may read, and the one statement that sets them. Every wrapper
// (withTenant, the auth wrappers, withPlatformAdmin, ping) sets or clears all of them with
// `set_config(..., true)`, so a session-level value left on a pooled connection never applies
// and nothing outlives the transaction (ADR-0030).
import { type SQL, sql } from 'drizzle-orm';

export interface AppSettings {
  /** Read by current_tenant_id(): tenant RLS policies. */
  tenantId?: string | undefined;
  branchId?: string | undefined;
  /** Read by current_user_id(): identity and own-membership policies. */
  userId?: string | undefined;
  /** The platform event of a withPlatformAdmin() transaction ('' elsewhere). */
  adminReason?: string | undefined;
  /** Read by current_link_token_hash(): the shifa_auth setup-link policy. */
  linkTokenHash?: string | undefined;
}

/** Raised before any SQL is sent when a context value is malformed. */
export class TenantContextError extends Error {
  override name = 'TenantContextError';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_HEX = /^[0-9a-f]{64}$/;

export function assertUuid(field: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    // The value itself is not echoed: it may be user input.
    throw new TenantContextError(`${field} must be a UUID`);
  }
}

export function assertTokenHash(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !SHA256_HEX.test(value)) {
    throw new TenantContextError('the setup-link token hash must be 64 lower-case hex digits');
  }
}

/** One statement setting every `app.*` setting for this transaction ('' = unset). */
export function contextSetup(s: AppSettings): SQL {
  return sql`select set_config('app.tenant_id', ${s.tenantId ?? ''}, true),
                    set_config('app.branch_id', ${s.branchId ?? ''}, true),
                    set_config('app.user_id', ${s.userId ?? ''}, true),
                    set_config('app.admin_reason', ${s.adminReason ?? ''}, true),
                    set_config('app.link_token_hash', ${s.linkTokenHash ?? ''}, true)`;
}
