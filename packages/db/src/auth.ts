// The identity path (ADR-0043): the shifa_auth role, for the Better Auth adapter, setup-link
// lookups and a person's own memberships across tenants. It never sets a tenant, so the tenant
// tables' policies show it nothing; its own policies and privileges are listed in the
// classification and pinned by test/privileges.test.ts.
import type { Pool } from 'pg';
import { type AppSettings, assertTokenHash, assertUuid, contextSetup } from './context.ts';
import { type CreateDbOptions, openPool } from './pool.ts';
import { runScoped, type Tx } from './transaction.ts';

export interface AuthDb {
  /**
   * Identity tables only (user, session, account, two_factor, verification, auth_throttle) and
   * audit events with a null tenant: what the Better Auth adapter needs before anyone is known.
   */
  withAuth<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** As withAuth(), plus this person's own memberships and the tenants they belong to. */
  withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
  /**
   * As withAuth(), plus the one setup link whose SHA-256 token hash (64 hex digits) is given:
   * it can be read and its `used_at` set, nothing else.
   */
  withSetupLink<T>(tokenHashHex: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Ends the pool at shutdown; later calls return the same promise. */
  close(): Promise<void>;
}

function runAsAuth<T>(pool: Pool, settings: AppSettings, fn: (tx: Tx) => Promise<T>) {
  return runScoped(pool, 'shifa_auth', contextSetup(settings), fn);
}

/** Opens a pool as shifa_auth (checked per connection like createDb()). */
export function createAuthDb(url: string, options: CreateDbOptions = {}): AuthDb {
  const { pool, close } = openPool(url, options);
  return {
    withAuth: (fn) => runAsAuth(pool, {}, fn),
    withUser: async (userId, fn) => {
      assertUuid('userId', userId);
      return runAsAuth(pool, { userId }, fn);
    },
    withSetupLink: async (tokenHashHex, fn) => {
      assertTokenHash(tokenHashHex);
      return runAsAuth(pool, { linkTokenHash: tokenHashHex }, fn);
    },
    close,
  };
}
