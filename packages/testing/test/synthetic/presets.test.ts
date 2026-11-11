// Spec 0.2-08 criterion 3 and edge cases: preset shapes and rejected input.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOAD_PARAMS,
  generateDataset,
  InvalidPresetParamsError,
  InvalidSeedError,
  LOAD_LIMITS,
  type SyntheticDataset,
  UnknownPresetError,
} from '../../src/index.ts';

const perTenant = (dataset: SyntheticDataset, tenantId: string) => ({
  branches: dataset.branches.filter((branch) => branch.tenantId === tenantId).length,
  practitioners: new Set(
    dataset.practitionerRoles
      .filter((role) => role.tenantId === tenantId)
      .map((role) => role.practitionerId),
  ).size,
  patients: dataset.charts.filter((chart) => chart.tenantId === tenantId).length,
});

describe('minimal preset', () => {
  it('has exactly 2 solo tenants, one per city, 1 branch, 1 practitioner and ≥ 5 patients each', () => {
    for (const seed of [1, 2, 3]) {
      const dataset = generateDataset({ seed, preset: 'minimal' });
      expect(dataset.preset).toBe('minimal');
      expect(dataset.tenants.length).toBe(2);
      expect(dataset.tenants.map((tenant) => tenant.city).sort()).toEqual(['aleppo', 'azaz']);
      for (const tenant of dataset.tenants) {
        expect(tenant.kind).toBe('solo');
        const counts = perTenant(dataset, tenant.id);
        expect(counts.branches).toBe(1);
        expect(counts.practitioners).toBe(1);
        expect(counts.patients).toBeGreaterThanOrEqual(5);
      }
    }
  });
});

describe('demo preset', () => {
  it('has ≥ 4 tenants covering every kind and both cities', () => {
    const dataset = generateDataset({ seed: 1, preset: 'demo' });
    expect(dataset.tenants.length).toBeGreaterThanOrEqual(4);
    const kinds = new Set(dataset.tenants.map((tenant) => tenant.kind));
    expect([...kinds].sort()).toEqual(['multi-branch', 'multi-doctor', 'solo']);
    const cities = new Set(dataset.tenants.map((tenant) => tenant.city));
    expect([...cities].sort()).toEqual(['aleppo', 'azaz']);
    for (const tenant of dataset.tenants) {
      const counts = perTenant(dataset, tenant.id);
      if (tenant.kind === 'multi-doctor') expect(counts.practitioners).toBeGreaterThanOrEqual(2);
      if (tenant.kind === 'multi-branch') expect(counts.branches).toBeGreaterThanOrEqual(2);
      expect(counts.patients).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('load preset', () => {
  it('defaults to 50 tenants × 1,000 patients', () => {
    expect(DEFAULT_LOAD_PARAMS).toEqual({ tenants: 50, patientsPerTenant: 1000 });
    expect(LOAD_LIMITS).toEqual({ maxTenants: 10_000, maxPatients: 1_000_000 });
  });

  it('builds exactly the requested counts for small parameters', () => {
    const dataset = generateDataset({
      seed: 4,
      preset: 'load',
      load: { tenants: 6, patientsPerTenant: 25 },
    });
    expect(dataset.tenants.length).toBe(6);
    expect(new Set(dataset.tenants.map((tenant) => tenant.city)).size).toBe(2);
    expect(new Set(dataset.tenants.map((tenant) => tenant.kind)).size).toBe(3);
    for (const tenant of dataset.tenants) {
      expect(perTenant(dataset, tenant.id).patients).toBe(25);
    }
  });

  it('rejects zero, non-integer and over-cap parameters with a typed error', () => {
    const bad = [
      { tenants: 0, patientsPerTenant: 10 },
      { tenants: 2, patientsPerTenant: 0 },
      { tenants: -1, patientsPerTenant: 10 },
      { tenants: 1.5, patientsPerTenant: 10 },
      { tenants: 2, patientsPerTenant: 2.5 },
      { tenants: 10_001, patientsPerTenant: 1 },
      { tenants: 1, patientsPerTenant: 1_000_001 },
      { tenants: 2, patientsPerTenant: 600_000 },
    ];
    for (const load of bad) {
      expect(() => generateDataset({ seed: 1, preset: 'load', load })).toThrow(
        InvalidPresetParamsError,
      );
    }
  });

  it('rejects load parameters on another preset', () => {
    expect(() =>
      generateDataset({ seed: 1, preset: 'minimal', load: { tenants: 2, patientsPerTenant: 5 } }),
    ).toThrow(InvalidPresetParamsError);
  });
});

describe('input validation', () => {
  it('rejects non-integer seeds with InvalidSeedError', () => {
    for (const seed of [1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => generateDataset({ seed, preset: 'minimal' })).toThrow(InvalidSeedError);
    }
  });

  it('rejects an unknown preset with UnknownPresetError', () => {
    expect(() => generateDataset({ seed: 1, preset: 'huge' as 'minimal' })).toThrow(
      UnknownPresetError,
    );
  });
});
