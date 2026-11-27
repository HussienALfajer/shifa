// The super-admin path (ADR-0005 "own role and audit", ADR-0043): the shifa_platform role, with
// one audit row per call written in the same transaction as the work, so an action and its
// audit row commit or roll back together. No tenant context: tenant tables show it nothing,
// and it holds no SELECT on them except `deployment_route`, which holds no clinic data (super
// admins see no clinic data; support access is A-02).
import { sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { PLATFORM_EVENTS, type PlatformEvent, REQUEST_ID } from './audit.ts';
import { assertUuid, contextSetup, TenantContextError } from './context.ts';
import { type CreateDbOptions, openPool } from './pool.ts';
import { runScoped, type Tx } from './transaction.ts';

declare const PLATFORM_TX: unique symbol;
/** A transaction on the platform path; createClinic() and other platform helpers require it. */
export type PlatformTx = Tx & { readonly [PLATFORM_TX]: true };

export interface PlatformAction {
  /** The super admin's user id. */
  actorId: string;
  event: PlatformEvent;
  /** The API request id, when the action comes from a request. */
  requestId?: string;
  /** What the action is about (a tenant, an owner); can also be set during the work. */
  targetId?: string;
  /** Small allowlisted details (enum values, flags): never a phone, name, token or code. */
  data?: Readonly<Record<string, string | boolean | null>>;
}

/**
 * Keys and values allowed in `data`: enum-like words, ids (a lower-case UUID), numbers, dates and
 * dotted catalogue keys (`limits.branches`, A-02-02) only.
 */
const DATA_KEY = /^[a-z][a-zA-Z]{0,31}$/;
const DATA_VALUE = /^[a-z0-9_.-]{0,36}$/;

/** Lets the work name its target once it is known (e.g. the id of a clinic it created). */
export interface AuditTarget {
  setTarget(id: string): void;
  /** Adds details learnt during the work (A-02-02: an override's value before); same rules. */
  setData(data: NonNullable<PlatformAction['data']>): void;
}

export interface PlatformDb {
  withPlatformAdmin<T>(
    action: PlatformAction,
    fn: (tx: PlatformTx, audit: AuditTarget) => Promise<T>,
  ): Promise<T>;
  /** Ends the pool at shutdown; later calls return the same promise. */
  close(): Promise<void>;
}

// The audit target of each live platform transaction, so platform helpers such as createClinic()
// can name what they created without every caller passing it along.
const targets = new WeakMap<PlatformTx, AuditTarget>();

/** The audit target of `tx`'s withPlatformAdmin() call (package-internal). */
export function auditTargetOf(tx: PlatformTx): AuditTarget | undefined {
  return targets.get(tx);
}

function assertAction(action: PlatformAction): void {
  assertUuid('actorId', action.actorId);
  if (!(PLATFORM_EVENTS as readonly string[]).includes(action.event)) {
    throw new TenantContextError('event must be one of PLATFORM_EVENTS');
  }
  if (action.requestId !== undefined && !REQUEST_ID.test(action.requestId)) {
    throw new TenantContextError('requestId must be 1 to 64 letters, digits or ._:-');
  }
  if (action.targetId !== undefined) assertUuid('targetId', action.targetId);
  assertData(action.data ?? {});
}

function assertData(data: NonNullable<PlatformAction['data']>): void {
  for (const [key, value] of Object.entries(data)) {
    if (!DATA_KEY.test(key) || (typeof value === 'string' && !DATA_VALUE.test(value))) {
      throw new TenantContextError('audit data must be short identifiers and enum values');
    }
  }
}

async function runAsPlatformAdmin<T>(
  pool: Pool,
  action: PlatformAction,
  fn: (tx: PlatformTx, audit: AuditTarget) => Promise<T>,
): Promise<T> {
  assertAction(action);
  let targetId = action.targetId;
  let data = { ...action.data };
  const audit: AuditTarget = {
    setTarget: (id) => {
      assertUuid('targetId', id);
      targetId = id;
    },
    setData: (more) => {
      assertData(more);
      data = { ...data, ...more };
    },
  };
  // app.user_id is the acting super admin (A-02-05 review 5): support policies tie a grant's
  // writes to it. No other policy for shifa_platform reads it (they are for shifa_app or shifa_auth).
  const setup = contextSetup({ adminReason: action.event, userId: action.actorId });
  return runScoped(pool, 'shifa_platform', setup, async (tx) => {
    const platformTx = tx as PlatformTx;
    targets.set(platformTx, audit);
    const result = await fn(platformTx, audit);
    // Written last, so the row carries the target the work named; a throw above leaves none.
    await tx.execute(sql`insert into audit_event
        (tenant_id, actor_id, target_id, event, request_id, data)
      values (null, ${action.actorId}, ${targetId ?? null}, ${action.event},
              ${action.requestId ?? null}, ${JSON.stringify(data)}::jsonb)`);
    return result;
  });
}

/** Opens a pool as shifa_platform (checked per connection like createDb()). */
export function createPlatformDb(url: string, options: CreateDbOptions = {}): PlatformDb {
  const { pool, close } = openPool(url, options);
  return {
    withPlatformAdmin: (action, fn) => runAsPlatformAdmin(pool, action, fn),
    close,
  };
}
