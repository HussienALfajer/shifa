/** Dataset presets: `minimal` (isolation), `demo` (owner demos) and `load` (performance). */
import { NAME_VARIANT_SAMPLES, type NameVariantSample } from '../names/person-name.ts';
import type { PinnedPatient, TenantPlan } from './build-tenant.ts';
import type { DatasetPreset, TenantKind } from './model.ts';

export class UnknownPresetError extends TypeError {
  constructor(preset: unknown) {
    super(`Unknown synthetic dataset preset: ${String(preset)}`);
    this.name = 'UnknownPresetError';
  }
}

export class InvalidPresetParamsError extends RangeError {
  constructor(reason: string) {
    super(`Invalid synthetic preset parameters: ${reason}`);
    this.name = 'InvalidPresetParamsError';
  }
}

export const DATASET_PRESETS: readonly DatasetPreset[] = ['minimal', 'demo', 'load'];

export interface LoadParams {
  readonly tenants: number;
  readonly patientsPerTenant: number;
}

export const DEFAULT_LOAD_PARAMS: LoadParams = { tenants: 50, patientsPerTenant: 1000 };

/** `maxPatients` caps tenants × patientsPerTenant (charts, not accounts). */
export const LOAD_LIMITS = { maxTenants: 10_000, maxPatients: 1_000_000 } as const;

const pinVariant = (sample: NameVariantSample, spelling: 0 | 1): PinnedPatient => ({
  ...(sample.sex === undefined ? {} : { sex: sample.sex }),
  name: { [sample.part]: sample.spellings[spelling] },
});

const variants = Object.values(NAME_VARIANT_SAMPLES.variants);

/**
 * Edge cases split over two tenants: set A holds the duplicate full-name pair (one organization)
 * and the listed spellings, set B the variant spellings people also type. إبراهيم / ابراهيم add
 * the إ form to the hamza class next to أحمد / احمد.
 */
const PINNED_A: readonly PinnedPatient[] = [
  { sex: 'male', name: NAME_VARIANT_SAMPLES.duplicatePair[0] },
  { sex: 'male', name: NAME_VARIANT_SAMPLES.duplicatePair[1] },
  ...variants.map((sample) => pinVariant(sample, 0)),
  { sex: 'male', name: { given: 'إبراهيم' } },
];
const PINNED_B: readonly PinnedPatient[] = [
  ...variants.map((sample) => pinVariant(sample, 1)),
  { sex: 'male', name: { given: 'ابراهيم' } },
];

const solo = (city: TenantPlan['city'], patients: number, pinned?: readonly PinnedPatient[]) => ({
  kind: 'solo' as const,
  city,
  branches: 1,
  practitioners: 1,
  patients,
  ...(pinned === undefined ? {} : { pinned }),
});

/** A tenant's role and chart that cross into another tenant (PLT-05, global accounts). */
export interface CrossTenantLinks {
  /** First practitioner of `from` gets a role in the first branch of `to`. */
  readonly practitioner?: { readonly from: number; readonly to: number };
  /** First account of `from` gets a chart in the organization of `to`. */
  readonly account?: { readonly from: number; readonly to: number };
}

export interface PresetPlan {
  readonly tenants: readonly TenantPlan[];
  readonly cross: CrossTenantLinks;
}

const MINIMAL: PresetPlan = {
  tenants: [solo('aleppo', 11, PINNED_A), solo('azaz', 11, PINNED_B)],
  cross: {},
};

const DEMO: PresetPlan = {
  tenants: [
    solo('aleppo', 12),
    {
      kind: 'multi-doctor',
      city: 'aleppo',
      branches: 1,
      practitioners: 3,
      patients: 25,
      pinned: PINNED_A,
    },
    {
      kind: 'multi-branch',
      city: 'azaz',
      branches: 3,
      practitioners: 5,
      patients: 30,
      pinned: PINNED_B,
    },
    solo('azaz', 12),
    { kind: 'multi-branch', city: 'aleppo', branches: 2, practitioners: 4, patients: 30 },
  ],
  cross: { practitioner: { from: 1, to: 4 }, account: { from: 1, to: 4 } },
};

const LOAD_KINDS: readonly TenantKind[] = ['solo', 'multi-doctor', 'multi-branch'];
const LOAD_SHAPE: Readonly<Record<TenantKind, { branches: number; practitioners: number }>> = {
  solo: { branches: 1, practitioners: 1 },
  'multi-doctor': { branches: 1, practitioners: 4 },
  'multi-branch': { branches: 3, practitioners: 6 },
};

export const validateLoadParams = (params: LoadParams): void => {
  const { tenants, patientsPerTenant } = params;
  if (!Number.isSafeInteger(tenants) || tenants < 1 || tenants > LOAD_LIMITS.maxTenants) {
    throw new InvalidPresetParamsError(
      `tenants must be an integer in 1..${String(LOAD_LIMITS.maxTenants)}`,
    );
  }
  if (!Number.isSafeInteger(patientsPerTenant) || patientsPerTenant < 1) {
    throw new InvalidPresetParamsError('patientsPerTenant must be a positive integer');
  }
  if (tenants * patientsPerTenant > LOAD_LIMITS.maxPatients) {
    throw new InvalidPresetParamsError(
      `more than ${String(LOAD_LIMITS.maxPatients)} patients in total`,
    );
  }
};

/** Kinds cycle solo → multi-doctor → multi-branch; cities alternate Aleppo and Azaz. */
const loadPlan = (params: LoadParams): PresetPlan => ({
  tenants: Array.from({ length: params.tenants }, (_, index) => {
    const kind = LOAD_KINDS[index % LOAD_KINDS.length] ?? 'solo';
    return {
      kind,
      city: index % 2 === 0 ? 'aleppo' : 'azaz',
      ...LOAD_SHAPE[kind],
      patients: params.patientsPerTenant,
    };
  }),
  cross: {},
});

export const presetPlan = (preset: DatasetPreset, load: LoadParams | undefined): PresetPlan => {
  if (!DATASET_PRESETS.includes(preset)) throw new UnknownPresetError(preset);
  if (preset !== 'load') {
    if (load !== undefined) {
      throw new InvalidPresetParamsError(`load parameters given for the ${preset} preset`);
    }
    return preset === 'minimal' ? MINIMAL : DEMO;
  }
  const params = load ?? DEFAULT_LOAD_PARAMS;
  validateLoadParams(params);
  return loadPlan(params);
};
