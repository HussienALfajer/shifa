// What the active clinic may use (A-02 criteria 4–6; contract rows `A02cLimits`, `addAtLimit`,
// `settings`): features on or off, each limit with its use, every flag evaluated for the clinic;
// and the owner's «الاشتراك» card. Entitlements and flags come from their cached ports (the
// criterion 2 rule); use is counted now, in the scope the guard checked.
import { Inject, Injectable } from '@nestjs/common';
import type { Capabilities, LimitUse, Subscription } from '@shifa/contracts';
import { tenant } from '@shifa/db';
import { eq } from 'drizzle-orm';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import {
  ENTITLEMENT_CATALOGUE,
  ENTITLEMENTS,
  type EntitlementCatalogue,
  type EntitlementsPort,
  type Usage,
  usageInClinic,
} from '../entitlements/index.ts';
import { FLAGS, type FlagClient } from '../flags/index.ts';

@Injectable()
export class CapabilitiesService {
  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(ENTITLEMENTS) private readonly entitlements: EntitlementsPort,
    @Inject(ENTITLEMENT_CATALOGUE) private readonly catalogue: EntitlementCatalogue,
    @Inject(FLAGS) private readonly flags: FlagClient,
  ) {}

  async capabilities(scope: RequestScope): Promise<Capabilities> {
    const values = await this.entitlements.all(scope);
    const used = await this.tenants.run(scope, (tx) => usageInClinic(tx));
    return {
      entitlements: Object.fromEntries(
        this.#keys('feature').map((key) => [key, values.get(key) === true]),
      ),
      limits: this.#limits(values, used),
      flags: await this.flags.all(scope),
    };
  }

  async subscription(scope: RequestScope): Promise<Subscription> {
    const values = await this.entitlements.all(scope);
    const { own, used } = await this.tenants.run(scope, async (tx) => {
      const [row] = await tx
        .select({
          type: tenant.type,
          status: tenant.status,
          subscriptionEnd: tenant.subscriptionEnd,
        })
        .from(tenant)
        .where(eq(tenant.id, scope.tenantId));
      if (!row) throw new Error('the scope’s clinic has no tenant row');
      return { own: row, used: await usageInClinic(tx) };
    });
    return {
      plan: own.type,
      status: own.status,
      subscriptionEnd: own.subscriptionEnd,
      limits: this.#limits(values, used),
      features: this.#keys('feature').filter((key) => values.get(key) === true),
    };
  }

  #keys(kind: 'limit' | 'feature'): string[] {
    return this.catalogue
      .definitions()
      .filter((d) => d.kind === kind)
      .map((d) => d.key);
  }

  #limits(values: ReadonlyMap<string, unknown>, used: Usage): LimitUse[] {
    return this.#keys('limit').map((key) => ({
      key,
      limit: Number(values.get(key) ?? 0),
      used: used[key] ?? null,
    }));
  }
}
