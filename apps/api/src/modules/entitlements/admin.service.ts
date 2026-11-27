// The super admin's entitlement work (A-02 criteria 1–3, 18, 20): each call is one
// withPlatformAdmin() transaction with its audit row; a clinic's add-ons, overrides and history are
// read and written inside its tenant context (restrictive policies keep each to its action).
// Override reasons stay on the override and in its history, never in audit data, logs or errors.
// After a change this instance's cache entry for the clinic is cleared at once (criterion 2).
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ClinicEntitlements,
  EntitlementItem,
  EntitlementValue,
  OverrideHistory,
  SetOverrideRequest,
  TypePreview,
} from '@shifa/contracts';
import {
  type AuditTarget,
  inTenantContext,
  type OverrideState,
  type PlatformAction,
  type PlatformDb,
  type PlatformTx,
  type TenantType,
  tenant,
  tenantOverride,
  tenantOverrideEvent,
} from '@shifa/db';
import { and, asc, eq } from 'drizzle-orm';
import type { Principal } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { OwnerAccounts } from '../identity/index.ts';
import { ENTITLEMENTS, type EntitlementsPort } from './cache.ts';
import { ENTITLEMENT_CATALOGUE, type EntitlementCatalogue } from './catalogue.ts';
import { endOfDamascusDay, isAfterToday, lastDamascusDay } from './damascus.ts';
import { keyHistory } from './history.ts';
import { overrideActive, resolveKey } from './resolve.ts';
import { loadSources, overrideRows, planValues } from './sources.ts';
import { ENTITLEMENTS_PLATFORM_DB } from './tokens.ts';
import { usageOf } from './usage-counts.ts';

type OverrideRow = typeof tenantOverride.$inferSelect;

/** An audit value: a number or boolean as text, or null (no override). */
const auditValue = (value: EntitlementValue | undefined) =>
  value === undefined ? null : String(value);

@Injectable()
export class EntitlementsAdmin {
  constructor(
    @Inject(ENTITLEMENTS_PLATFORM_DB) private readonly platformDb: PlatformDb,
    @Inject(ENTITLEMENT_CATALOGUE) private readonly catalogue: EntitlementCatalogue,
    @Inject(ENTITLEMENTS) private readonly entitlements: EntitlementsPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(OwnerAccounts) private readonly owners: OwnerAccounts,
  ) {}

  view(principal: Principal, id: string, requestId: string): Promise<ClinicEntitlements> {
    const action = { event: 'entitlement.viewed', requestId, targetId: id } as const;
    return this.#run(principal, action, (tx) => this.#entitlementsIn(tx, id));
  }

  /** The clinic's plan and items, read in the caller's transaction (any entitlement action). */
  async #entitlementsIn(tx: PlatformTx, id: string): Promise<ClinicEntitlements> {
    const type = await clinicType(tx, id);
    const now = this.clock.now();
    const { sources, overrides } = await inTenantContext(tx, id, async (sp) => ({
      sources: await loadSources(sp, type),
      overrides: await overrideRows(sp),
    }));
    const names = await this.owners.displayNames(overrides.map((o) => o.setBy));
    // Integers only (A-02-03: `used` beside each limit; null for a key not counted yet).
    const used = await usageOf(tx, id);
    return {
      plan: type,
      items: this.catalogue.definitions().map((d) => {
        const override = overrides.find((o) => o.key === d.key);
        return {
          key: d.key,
          kind: d.kind,
          planValue: sources.planValues[d.key] ?? deny(d.kind),
          override: override ? overrideView(override, now, names) : null,
          effective: resolveKey(this.catalogue, d.key, sources, now),
          used: d.kind === 'limit' ? (used[d.key] ?? null) : null,
        };
      }),
    };
  }

  async #itemIn(tx: PlatformTx, id: string, key: string): Promise<EntitlementItem> {
    const item = (await this.#entitlementsIn(tx, id)).items.find((i) => i.key === key);
    if (!item) throw new NotFoundException();
    return item;
  }

  async setOverride(
    principal: Principal,
    id: string,
    key: string,
    input: SetOverrideRequest,
    requestId: string,
  ): Promise<EntitlementItem> {
    this.#knownKey(key);
    const kind = this.catalogue.kindOf(key);
    const now = this.clock.now();
    const valid =
      kind === 'limit' ? typeof input.value === 'number' : typeof input.value === 'boolean';
    if (!valid) throw new RequestValidationError([{ path: 'body.value', code: 'invalid_type' }]);
    const expiresOn = input.expiresAt ?? null;
    if (expiresOn !== null && !isAfterToday(expiresOn, now)) {
      throw new RequestValidationError([{ path: 'body.expiresAt', code: 'too_small' }]);
    }
    const action = {
      event: 'entitlement.override_set',
      requestId,
      targetId: id,
      data: { key, after: auditValue(input.value), expires: expiresOn },
    } as const;
    return this.#change(principal, id, action, async (tx, setData) => {
      // The clinic row locked: changes of one clinic's overrides and type run one at a time, so
      // each reads the `before` the previous one left (security review L1).
      await clinicType(tx, id, true);
      await inTenantContext(tx, id, async (sp) => {
        const existing = await currentOverride(sp, key);
        const active = existing && overrideActive(existing, now) ? existing : undefined;
        setData({ before: auditValue(active?.value) });
        const row = {
          value: input.value,
          reason: input.reason,
          expiresAt: expiresOn === null ? null : endOfDamascusDay(expiresOn),
          setBy: principal.userId,
          setAt: now,
        };
        if (existing) {
          await sp.update(tenantOverride).set(row).where(overrideOf(id, key));
        } else {
          await sp.insert(tenantOverride).values({ tenantId: id, key, ...row });
        }
        await sp.insert(tenantOverrideEvent).values({
          tenantId: id,
          key,
          kind: active ? 'changed' : 'set',
          before: active ? stateOf(active) : null,
          after: { value: input.value, expiresAt: expiresOn },
          reason: input.reason,
          by: principal.userId,
          at: now,
        });
      });
      return this.#itemIn(tx, id, key);
    });
  }

  async removeOverride(
    principal: Principal,
    id: string,
    key: string,
    requestId: string,
  ): Promise<EntitlementItem> {
    this.#knownKey(key);
    const now = this.clock.now();
    const action = {
      event: 'entitlement.override_removed',
      requestId,
      targetId: id,
      data: { key, after: null },
    } as const;
    return this.#change(principal, id, action, async (tx, setData) => {
      await clinicType(tx, id, true);
      await inTenantContext(tx, id, async (sp) => {
        const existing = await currentOverride(sp, key);
        if (!existing) throw new NotFoundException();
        setData({ before: auditValue(existing.value) });
        const removed = await sp
          .delete(tenantOverride)
          .where(overrideOf(id, key))
          .returning({ key: tenantOverride.key });
        if (removed.length === 0) throw new NotFoundException();
        await sp.insert(tenantOverrideEvent).values({
          tenantId: id,
          key,
          kind: 'removed',
          before: stateOf(existing),
          after: null,
          reason: null,
          by: principal.userId,
          at: now,
        });
      });
      return this.#itemIn(tx, id, key);
    });
  }

  history(
    principal: Principal,
    id: string,
    key: string,
    requestId: string,
  ): Promise<OverrideHistory> {
    this.#knownKey(key);
    const action = {
      event: 'entitlement.history_viewed',
      requestId,
      targetId: id,
      data: { key },
    } as const;
    return this.#run(principal, action, async (tx) => {
      await clinicType(tx, id);
      const rows = await inTenantContext(tx, id, (sp) =>
        sp
          .select()
          .from(tenantOverrideEvent)
          .where(and(eq(tenantOverrideEvent.tenantId, id), eq(tenantOverrideEvent.key, key)))
          .orderBy(asc(tenantOverrideEvent.at)),
      );
      const names = await this.owners.displayNames(rows.map((r) => r.by));
      return { events: keyHistory(rows, this.clock.now(), names) };
    });
  }

  preview(
    principal: Principal,
    id: string,
    type: TenantType,
    requestId: string,
  ): Promise<TypePreview> {
    const action = {
      event: 'clinic.type_previewed',
      requestId,
      targetId: id,
      data: { type },
    } as const;
    return this.#run(principal, action, async (tx) => {
      const current = await clinicType(tx, id);
      if (current === type) {
        throw new RequestValidationError([{ path: 'query.type', code: 'invalid_value' }]);
      }
      const now = this.clock.now();
      const { sources, next } = await inTenantContext(tx, id, async (sp) => ({
        sources: await loadSources(sp, current),
        next: await loadSources(sp, type),
      }));
      const used = await usageOf(tx, id);
      const limits = this.catalogue
        .definitions()
        .filter((d) => d.kind === 'limit')
        .map((d) => {
          const after = Number(resolveKey(this.catalogue, d.key, next, now));
          const use = used[d.key] ?? 0;
          return {
            key: d.key,
            current: Number(resolveKey(this.catalogue, d.key, sources, now)),
            next: after,
            used: use,
            over: after < use,
          };
        });
      return { type, limits };
    });
  }

  /**
   * Inside a `clinic.type_changed` transaction (the platform module's PATCH): one `type_changed`
   * history event per key whose plan value moved. Overrides stay as they are (criterion 3).
   */
  async recordTypeChange(
    tx: PlatformTx,
    id: string,
    from: TenantType,
    to: TenantType,
    actorId: string,
  ): Promise<void> {
    const before = new Map((await planValues(tx, from)).map((p) => [p.key, p.value]));
    const after = new Map((await planValues(tx, to)).map((p) => [p.key, p.value]));
    const now = this.clock.now();
    const moved = this.catalogue
      .definitions()
      .filter((d) => before.get(d.key) !== after.get(d.key));
    if (moved.length === 0) return;
    await inTenantContext(tx, id, async (sp) => {
      for (const d of moved) {
        const state = (value: EntitlementValue | undefined): OverrideState => ({
          value: value ?? deny(d.kind),
          expiresAt: null,
        });
        await sp.insert(tenantOverrideEvent).values({
          tenantId: id,
          key: d.key,
          kind: 'type_changed',
          before: state(before.get(d.key)),
          after: state(after.get(d.key)),
          reason: null,
          by: actorId,
          at: now,
        });
      }
    });
  }

  /** Clears this instance's cache entry after a type change committed. */
  invalidate(id: string): void {
    this.entitlements.invalidate(id);
  }

  /** A key outside the catalogue answers 404 (contract row `override`). */
  #knownKey(key: string): void {
    if (!this.catalogue.has(key)) throw new NotFoundException();
  }

  /** A change of the clinic's overrides; this instance's cache entry is cleared once it commits. */
  async #change<T>(
    principal: Principal,
    id: string,
    action: Omit<PlatformAction, 'actorId'>,
    fn: (tx: PlatformTx, setData: (data: Record<string, string | null>) => void) => Promise<T>,
  ): Promise<T> {
    const result = await this.#run(principal, action, (tx, audit) =>
      fn(tx, (data) => {
        audit.setData(data);
      }),
    );
    this.entitlements.invalidate(id);
    return result;
  }

  #run<T>(
    principal: Principal,
    action: Omit<PlatformAction, 'actorId'>,
    fn: (tx: PlatformTx, audit: AuditTarget) => Promise<T>,
  ): Promise<T> {
    return this.platformDb.withPlatformAdmin({ ...action, actorId: principal.userId }, fn);
  }
}

const deny = (kind: 'limit' | 'feature'): EntitlementValue => (kind === 'limit' ? 0 : false);

const overrideOf = (id: string, key: string) =>
  and(eq(tenantOverride.tenantId, id), eq(tenantOverride.key, key));

async function currentOverride(tx: PlatformTx, key: string): Promise<OverrideRow | undefined> {
  const [row] = await tx.select().from(tenantOverride).where(eq(tenantOverride.key, key));
  return row;
}

function stateOf(row: OverrideRow): OverrideState {
  return { value: row.value, expiresAt: row.expiresAt ? lastDamascusDay(row.expiresAt) : null };
}

function overrideView(row: OverrideRow, now: Date, names: ReadonlyMap<string, string>) {
  return {
    value: row.value,
    reason: row.reason,
    expiresAt: row.expiresAt ? lastDamascusDay(row.expiresAt) : null,
    expired: !overrideActive(row, now),
    setByName: names.get(row.setBy) ?? null,
    setAt: row.setAt.toISOString(),
  };
}

/** The clinic's type (its plan); 404 when there is no such clinic. */
async function clinicType(tx: PlatformTx, id: string, lock = false): Promise<TenantType> {
  const query = tx.select({ type: tenant.type }).from(tenant).where(eq(tenant.id, id));
  const [row] = lock ? await query.for('update') : await query;
  if (!row) throw new NotFoundException();
  return row.type;
}
