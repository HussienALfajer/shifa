// The clinic's own settings through the cascade (A-01a criterion 9, A-02 criterion 10): the owner
// reads the idle sign-out with its source and lock and changes it at the organization. Under a lock
// (the super admin's, or the platform's) the change answers 409 `setting_locked` and nothing is
// written. One audit row `clinic.settings_changed` per change, with key, scope, before and after.
import { Inject, Injectable } from '@nestjs/common';
import type { ClinicSettings, IdleMinutes, UpdateClinicSettingsRequest } from '@shifa/contracts';
import { auditEvent, settingValue, type Tx } from '@shifa/db';
import { sql } from 'drizzle-orm';
import type { z } from 'zod';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { ApiError } from '../../platform/errors.ts';
import {
  IDLE_MINUTES_KEY,
  SETTING_CATALOGUE,
  type SettingCatalogue,
  type SettingDefinition,
} from './catalogue.ts';
import { type Resolution, resolveSetting, resolveWithLocks, writeRefusal } from './resolve.ts';
import { platformRows, scopedValues, tenantRows } from './sources.ts';
import { clinicPlan, lockSettingWrites } from './store.ts';

type Idle = z.infer<typeof IdleMinutes>;

@Injectable()
export class ClinicSettingsService {
  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(SETTING_CATALOGUE) private readonly catalogue: SettingCatalogue,
  ) {}

  read(scope: RequestScope): Promise<ClinicSettings> {
    return this.tenants.run(scope, async (tx) => {
      const values = await this.#idleValues(tx, scope.tenantId);
      return view(resolveWithLocks(this.#idle(), values));
    });
  }

  update(
    scope: RequestScope,
    body: UpdateClinicSettingsRequest,
    requestId: string,
  ): Promise<ClinicSettings> {
    const definition = this.#idle();
    return this.tenants.run(scope, async (tx) => {
      await lockSettingWrites(tx, scope.tenantId, IDLE_MINUTES_KEY);
      const values = await this.#idleValues(tx, scope.tenantId);
      const refusal = writeRefusal(definition, values, 'organization', body.idleMinutes);
      if (refusal === 'locked') throw new ApiError(409, 'setting_locked');
      // The contract allows only 15, 30 or 60, and the key is the organization's.
      if (refusal !== null) throw new Error(`idle setting write refused: ${refusal}`);
      const before = resolveSetting(definition, values).value;
      await tx
        .insert(settingValue)
        .values({
          tenantId: scope.tenantId,
          scope: 'organization',
          scopeId: null,
          key: IDLE_MINUTES_KEY,
          value: body.idleMinutes,
          setBy: scope.userId,
        })
        .onConflictDoUpdate({
          target: [
            settingValue.tenantId,
            settingValue.scope,
            settingValue.scopeId,
            settingValue.key,
          ],
          set: { value: body.idleMinutes, setBy: scope.userId, setAt: sql`now()` },
        });
      await tx.insert(auditEvent).values({
        tenantId: scope.tenantId,
        actorId: scope.userId,
        targetId: scope.tenantId,
        event: 'clinic.settings_changed',
        requestId,
        data: {
          idleMinutes: body.idleMinutes,
          key: IDLE_MINUTES_KEY,
          scope: 'organization',
          before,
          after: body.idleMinutes,
        },
      });
      return view(resolveWithLocks(definition, await this.#idleValues(tx, scope.tenantId)));
    });
  }

  #idle(): SettingDefinition {
    return this.catalogue.get(IDLE_MINUTES_KEY);
  }

  async #idleValues(tx: Tx, tenantId: string) {
    const planType = await clinicPlan(tx, tenantId);
    if (!planType) throw new Error('clinic row not visible in its own scope');
    return scopedValues(
      IDLE_MINUTES_KEY,
      await platformRows(tx, IDLE_MINUTES_KEY),
      await tenantRows(tx, IDLE_MINUTES_KEY),
      { planType },
    );
  }
}

function view(resolved: Resolution): ClinicSettings {
  return {
    idleMinutes: resolved.value as Idle,
    source: resolved.source,
    locked: resolved.locked,
  };
}
