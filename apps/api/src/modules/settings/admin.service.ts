// The super admin's settings work (A-02 criteria 9, 18): list a clinic's settings with value,
// source and lock; set and lock a value at the organization («قفل بقيمة», always together); unlock
// it (the organization's value is removed and the value is inherited again). Each call is one
// withPlatformAdmin() transaction with its audit row (setting.viewed, setting.locked,
// setting.unlocked: key, scope, before and after effective values); the clinic's values are read and
// written inside its tenant context, where restrictive policies keep them to these actions.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ClinicSettingList, SettingValue, SettingView } from '@shifa/contracts';
import {
  type AuditTarget,
  inTenantContext,
  type PlatformAction,
  type PlatformDb,
  type PlatformTx,
  settingValue,
  type TenantType,
} from '@shifa/db';
import { and, eq, sql } from 'drizzle-orm';
import type { Principal } from '../../access/index.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { SETTING_CATALOGUE, type SettingCatalogue, type SettingDefinition } from './catalogue.ts';
import { resolveSetting } from './resolve.ts';
import { platformRows, scopedValues, tenantRows } from './sources.ts';
import {
  auditValue,
  clinicPlan,
  lockedAboveClinic,
  lockSettingWrites,
  settingView,
} from './store.ts';
import { SETTINGS_PLATFORM_DB } from './tokens.ts';

/** The super admin locks at the clinic's organization (criterion 9). */
const SCOPE = 'organization';

@Injectable()
export class SettingsAdmin {
  constructor(
    @Inject(SETTINGS_PLATFORM_DB) private readonly platformDb: PlatformDb,
    @Inject(SETTING_CATALOGUE) private readonly catalogue: SettingCatalogue,
  ) {}

  list(principal: Principal, id: string, requestId: string): Promise<ClinicSettingList> {
    const action = { event: 'setting.viewed', requestId, targetId: id } as const;
    return this.#run(principal, action, async (tx) => {
      const planType = await planOf(tx, id);
      return inTenantContext(tx, id, async (sp) => {
        const [platform, own] = [await platformRows(sp), await tenantRows(sp)];
        return {
          settings: this.catalogue
            .definitions()
            .map((d) =>
              settingView(this.catalogue, d, scopedValues(d.key, platform, own, { planType })),
            ),
        };
      });
    });
  }

  lock(
    principal: Principal,
    id: string,
    key: string,
    value: SettingValue,
    requestId: string,
  ): Promise<SettingView> {
    const definition = this.#known(key);
    if (!definition.lockable) throw new ApiError(409, 'setting_not_lockable');
    if (!definition.schema.safeParse(value).success) {
      throw new RequestValidationError([{ path: 'body.value', code: 'invalid_value' }]);
    }
    const action = {
      event: 'setting.locked',
      requestId,
      targetId: id,
      data: { key, scope: SCOPE, after: auditValue(definition, value) },
    } as const;
    return this.#run(principal, action, async (tx, audit) => {
      const planType = await planOf(tx, id);
      return inTenantContext(tx, id, async (sp) => {
        await lockSettingWrites(sp, id, key);
        const values = await this.#values(sp, definition, planType);
        if (lockedAboveClinic(definition, values)) throw new ApiError(409, 'setting_not_lockable');
        audit.setData({ before: auditValue(definition, resolveSetting(definition, values).value) });
        await sp
          .insert(settingValue)
          .values({
            tenantId: id,
            scope: SCOPE,
            scopeId: null,
            key,
            value,
            locked: true,
            setBy: principal.userId,
          })
          .onConflictDoUpdate({
            target: [
              settingValue.tenantId,
              settingValue.scope,
              settingValue.scopeId,
              settingValue.key,
            ],
            set: { value, locked: true, setBy: principal.userId, setAt: sql`now()` },
          });
        return settingView(
          this.catalogue,
          definition,
          await this.#values(sp, definition, planType),
        );
      });
    });
  }

  unlock(principal: Principal, id: string, key: string, requestId: string): Promise<SettingView> {
    const definition = this.#known(key);
    const action = {
      event: 'setting.unlocked',
      requestId,
      targetId: id,
      data: { key, scope: SCOPE },
    } as const;
    return this.#run(principal, action, async (tx, audit) => {
      const planType = await planOf(tx, id);
      return inTenantContext(tx, id, async (sp) => {
        await lockSettingWrites(sp, id, key);
        const values = await this.#values(sp, definition, planType);
        const own = values.find((v) => v.scope === SCOPE);
        if (!own?.locked) throw new NotFoundException();
        const removed = await sp
          .delete(settingValue)
          .where(
            and(
              eq(settingValue.tenantId, id),
              eq(settingValue.scope, SCOPE),
              eq(settingValue.key, key),
              eq(settingValue.locked, true),
            ),
          )
          .returning({ id: settingValue.id });
        if (removed.length !== 1) throw new NotFoundException();
        const after = await this.#values(sp, definition, planType);
        audit.setData({
          before: auditValue(definition, resolveSetting(definition, values).value),
          after: auditValue(definition, resolveSetting(definition, after).value),
        });
        return settingView(this.catalogue, definition, after);
      });
    });
  }

  /** A key outside the catalogue answers 404 (contract rows `setDialog`, `unlockAsk`). */
  #known(key: string): SettingDefinition {
    if (!this.catalogue.has(key)) throw new NotFoundException();
    return this.catalogue.get(key);
  }

  async #values(sp: PlatformTx, definition: SettingDefinition, planType: TenantType) {
    return scopedValues(
      definition.key,
      await platformRows(sp, definition.key),
      await tenantRows(sp, definition.key),
      { planType },
    );
  }

  #run<T>(
    principal: Principal,
    action: Omit<PlatformAction, 'actorId'>,
    fn: (tx: PlatformTx, audit: AuditTarget) => Promise<T>,
  ): Promise<T> {
    return this.platformDb.withPlatformAdmin({ ...action, actorId: principal.userId }, fn);
  }
}

/** The clinic's type (its plan); 404 when there is no such clinic. */
async function planOf(tx: PlatformTx, id: string): Promise<TenantType> {
  const type = await clinicPlan(tx, id);
  if (!type) throw new NotFoundException();
  return type;
}
