/**
 * `generateDataset`: deterministic, in-memory synthetic clinics in Aleppo and Azaz (spec 0.2-08).
 * Pure: no I/O, no environment, no system time; dates come from the `clock` argument.
 */
import { type Clock, FixedClock } from '../../clock.ts';
import { IdRegistry } from '../ids.ts';
import { PhoneRegistry } from '../phones.ts';
import { createRandom } from '../random.ts';
import { buildTenant, type DatasetContext, formatMrn, type TenantBuild } from './build-tenant.ts';
import type { DatasetPreset, SyntheticDataset } from './model.ts';
import { type LoadParams, presetPlan } from './presets.ts';
import { createSink } from './sink.ts';

export interface GenerateDatasetOptions {
  /** Any safe integer, including 0 and negatives. */
  readonly seed: number;
  readonly preset: DatasetPreset;
  /** Default: `FixedClock` at 2026-01-01T00:00:00Z. */
  readonly clock?: Clock;
  /** Only for the `load` preset; default 50 tenants × 1,000 patients. */
  readonly load?: LoadParams;
}

export const DEFAULT_DATASET_CLOCK_START = '2026-01-01T00:00:00Z';

const at = (builds: readonly TenantBuild[], index: number): TenantBuild => {
  const build = builds[index];
  if (build === undefined) throw new RangeError(`Preset links a missing tenant ${String(index)}`);
  return build;
};

export const generateDataset = (options: GenerateDatasetOptions): SyntheticDataset => {
  const root = createRandom(options.seed);
  const plan = presetPlan(options.preset, options.load);
  const clock = options.clock ?? new FixedClock(DEFAULT_DATASET_CLOCK_START);
  const now = clock.now();

  const sink = createSink();
  const context: DatasetContext = {
    ids: new IdRegistry(),
    phones: new PhoneRegistry(),
    nowMs: now.getTime(),
    sink,
  };
  const tenantStreams = root.fork('tenants');
  const builds = plan.tenants.map((tenantPlan, index) =>
    buildTenant(tenantStreams.fork(String(index)), tenantPlan, context),
  );

  const cross = root.fork('cross');
  if (plan.cross.practitioner !== undefined) {
    const from = at(builds, plan.cross.practitioner.from);
    const to = at(builds, plan.cross.practitioner.to);
    const practitioner = from.practitioners[0];
    const branch = to.branches[0];
    if (practitioner !== undefined && branch !== undefined) {
      sink.practitionerRoles.push({
        id: context.ids.next(cross.fork('role-id')),
        tenantId: to.tenant.id,
        practitionerId: practitioner.id,
        organizationId: to.organization.id,
        branchId: branch.id,
      });
    }
  }
  if (plan.cross.account !== undefined) {
    const from = at(builds, plan.cross.account.from);
    const to = at(builds, plan.cross.account.to);
    const account = from.accounts[0];
    if (account !== undefined) {
      sink.charts.push({
        id: context.ids.next(cross.fork('chart-id')),
        tenantId: to.tenant.id,
        organizationId: to.organization.id,
        accountId: account.id,
        mrn: formatMrn(to.mrnCount + 1),
      });
    }
  }

  return {
    seed: options.seed,
    preset: options.preset,
    generatedAt: now.toISOString(),
    ...sink,
  };
};
