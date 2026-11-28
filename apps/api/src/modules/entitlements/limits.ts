// Limit enforcement (A-02 criterion 4, OD-110; A-03 criterion 15): an add that would pass the
// doctor, branch or custom field limit answers 409 `limit_reached` with key, limit and use, and
// nothing is written (the caller's transaction rolls back). Checked inside the write transaction,
// in the clinic's own context, under a per-clinic advisory lock, so two requests racing at the
// limit never both succeed: the second waits, then counts the first. The limit is resolved from
// the rows as they are now (not the cache), so a lowered limit is never passed by a stale entry. A
// limit lowered below use removes nothing: only new ones are refused.
//
// Lock order of the clinic's writes: owners (team edits) → limits → phone → rows.
import { Inject, Injectable } from '@nestjs/common';
import { type Tx, tenant } from '@shifa/db';
import { eq, sql } from 'drizzle-orm';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { ApiError } from '../../platform/errors.ts';
import { ENTITLEMENT_CATALOGUE, type EntitlementCatalogue } from './catalogue.ts';
import { resolveKey } from './resolve.ts';
import { loadSources } from './sources.ts';
import { type Usage, usageInClinic } from './usage-counts.ts';

/** The limits the API enforces. */
export type EnforcedLimit = 'limits.practitioners' | 'limits.branches' | 'limits.custom_fields';

@Injectable()
export class ClinicLimits {
  constructor(
    @Inject(ENTITLEMENT_CATALOGUE) private readonly catalogue: EntitlementCatalogue,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Serialises the clinic's adds against its limits until `tx` ends. Take it before any row lock
   * and before reading what the check counts. Transaction-scoped, so safe behind PgBouncer.
   */
  async lock(tx: Tx): Promise<void> {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('shifa.limits:' || current_tenant_id()::text, 0))`,
    );
  }

  /** The clinic's limit of `key` from its rows as they are now (not the cache). */
  async limitOf(tx: Tx, tenantId: string, key: EnforcedLimit): Promise<number> {
    const [own] = await tx
      .select({ type: tenant.type })
      .from(tenant)
      .where(eq(tenant.id, tenantId));
    if (!own) throw new Error('the scope’s clinic has no tenant row');
    const sources = await loadSources(tx, own.type);
    return Number(resolveKey(this.catalogue, key, sources, this.clock.now()));
  }

  /** What the clinic uses of each counted limit now, by the API's clock. */
  usage(tx: Tx): Promise<Usage> {
    return usageInClinic(tx, this.clock.now());
  }

  /** 409 `limit_reached` when one more of `key` would pass the clinic's limit (after lock()). */
  async assertRoom(tx: Tx, tenantId: string, key: EnforcedLimit): Promise<void> {
    const limit = await this.limitOf(tx, tenantId, key);
    const used = (await this.usage(tx))[key] ?? 0;
    if (used + 1 > limit) {
      throw new ApiError(409, 'limit_reached', undefined, undefined, { key, limit, used });
    }
  }
}
