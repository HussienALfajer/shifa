// The super admin's flag work (A-02 criteria 7, 18; contract rows of the flags board): the list of
// flags declared in code and a change of one flag, each one withPlatformAdmin() transaction with
// its audit row. A flag's reason stays on its row, never in audit data, logs or errors. After a
// change this instance's flag cache is cleared at once; other instances follow within 60 s.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { FlagList, FlagView, SetFlagRequest } from '@shifa/contracts';
import {
  type FlagMode,
  featureFlag,
  featureFlagTenant,
  type PlatformAction,
  type PlatformDb,
  type PlatformTx,
  tenant,
} from '@shifa/db';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { Principal } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { OwnerAccounts } from '../identity/index.ts';
import { FLAG_CATALOGUE, type FlagCatalogue, type FlagDefinition } from './catalogue.ts';
import { FLAGS, type FlagClient } from './client.ts';
import { FLAGS_PLATFORM_DB } from './tokens.ts';

type FlagRow = typeof featureFlag.$inferSelect;
interface Selection {
  flagKey: string;
  id: string;
  name: string;
}

const codeMode = (d: FlagDefinition): FlagMode => (d.defaultValue ? 'on' : 'off');

@Injectable()
export class FlagsAdmin {
  constructor(
    @Inject(FLAGS_PLATFORM_DB) private readonly platformDb: PlatformDb,
    @Inject(FLAG_CATALOGUE) private readonly catalogue: FlagCatalogue,
    @Inject(FLAGS) private readonly flags: FlagClient,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(OwnerAccounts) private readonly owners: OwnerAccounts,
  ) {}

  list(principal: Principal, requestId: string): Promise<FlagList> {
    return this.#run(principal, { event: 'flag.listed', requestId }, async (tx) => ({
      flags: await this.#views(tx, this.catalogue.definitions()),
    }));
  }

  async set(
    principal: Principal,
    key: string,
    input: SetFlagRequest,
    requestId: string,
  ): Promise<FlagView> {
    if (!this.catalogue.has(key)) throw new NotFoundException();
    const definition = this.catalogue.get(key);
    const clinicIds =
      input.clinicIds === undefined
        ? undefined
        : [...new Set(input.clinicIds.map((id) => id.toLowerCase()))];
    if (input.mode === 'selected' && (clinicIds === undefined || clinicIds.length === 0)) {
      throw new RequestValidationError([{ path: 'body.clinicIds', code: 'too_small' }]);
    }
    const action = { event: 'flag.changed', requestId, data: { key } } as const;
    const view = await this.#run(principal, action, async (tx, setData) => {
      // One change of a flag at a time, so each reads the `before` the previous one left.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`shifa.flag:${key}`}, 0))`,
      );
      const [existing] = await tx.select().from(featureFlag).where(eq(featureFlag.key, key));
      if (clinicIds !== undefined && clinicIds.length > 0) {
        const found = await tx
          .select({ id: tenant.id })
          .from(tenant)
          .where(inArray(tenant.id, clinicIds));
        if (found.length !== clinicIds.length) {
          throw new RequestValidationError([{ path: 'body.clinicIds', code: 'invalid_value' }]);
        }
      }
      const row = {
        mode: input.mode,
        reason: input.reason,
        changedBy: principal.userId,
        changedAt: this.clock.now(),
      };
      if (existing) {
        await tx.update(featureFlag).set(row).where(eq(featureFlag.key, key));
      } else {
        await tx.insert(featureFlag).values({ key, ...row });
      }
      if (clinicIds !== undefined) {
        await tx.delete(featureFlagTenant).where(eq(featureFlagTenant.flagKey, key));
        if (clinicIds.length > 0) {
          await tx
            .insert(featureFlagTenant)
            .values(clinicIds.map((tenantId) => ({ tenantId, flagKey: key })));
        }
      }
      const [changed] = await this.#views(tx, [definition]);
      if (!changed) throw new Error('flag view missing');
      setData({
        before: existing?.mode ?? codeMode(definition),
        after: input.mode,
        clinics: String(changed.clinics.length),
      });
      return changed;
    });
    this.flags.invalidateAll();
    return view;
  }

  /** The views of `definitions`, read in the caller's transaction (any flag action). */
  async #views(tx: PlatformTx, definitions: readonly FlagDefinition[]): Promise<FlagView[]> {
    if (definitions.length === 0) return [];
    const keys = definitions.map((d) => d.key);
    const rows = await tx.select().from(featureFlag).where(inArray(featureFlag.key, keys));
    const selections: Selection[] = await tx
      .select({ flagKey: featureFlagTenant.flagKey, id: tenant.id, name: tenant.name })
      .from(featureFlagTenant)
      .innerJoin(tenant, eq(tenant.id, featureFlagTenant.tenantId))
      .where(inArray(featureFlagTenant.flagKey, keys))
      .orderBy(asc(tenant.name));
    const names = await this.owners.displayNames(rows.map((r) => r.changedBy));
    return definitions.map((d) => view(d, rows, selections, names));
  }

  #run<T>(
    principal: Principal,
    action: Omit<PlatformAction, 'actorId'>,
    fn: (tx: PlatformTx, setData: (data: Record<string, string>) => void) => Promise<T>,
  ): Promise<T> {
    return this.platformDb.withPlatformAdmin(
      { ...action, actorId: principal.userId },
      (tx, audit) =>
        fn(tx, (data) => {
          audit.setData(data);
        }),
    );
  }
}

function view(
  d: FlagDefinition,
  rows: readonly FlagRow[],
  selections: readonly Selection[],
  names: ReadonlyMap<string, string>,
): FlagView {
  const row = rows.find((r) => r.key === d.key);
  return {
    key: d.key,
    description: d.description,
    defaultValue: d.defaultValue,
    mode: row?.mode ?? codeMode(d),
    clinics: selections.filter((s) => s.flagKey === d.key).map(({ id, name }) => ({ id, name })),
    reason: row?.reason ?? null,
    updatedByName: row ? (names.get(row.changedBy) ?? null) : null,
    updatedAt: row?.changedAt.toISOString() ?? null,
  };
}
