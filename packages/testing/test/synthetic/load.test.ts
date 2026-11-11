// Spec 0.2-08 criterion 13: the default load preset generates in under 10 s.
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOAD_PARAMS, generateDataset } from '../../src/index.ts';

const LIMIT_MS = 10_000;

describe('load preset performance', () => {
  it(
    'generates 50 tenants × 1,000 patients in under 10 s',
    () => {
      const started = performance.now();
      const dataset = generateDataset({ seed: 1, preset: 'load' });
      const elapsed = performance.now() - started;

      expect(dataset.tenants.length).toBe(DEFAULT_LOAD_PARAMS.tenants);
      expect(dataset.charts.length).toBeGreaterThanOrEqual(
        DEFAULT_LOAD_PARAMS.tenants * DEFAULT_LOAD_PARAMS.patientsPerTenant,
      );
      expect(new Set(dataset.patientAccounts.map((account) => account.phone)).size).toBe(
        dataset.patientAccounts.length,
      );
      expect(elapsed, `took ${elapsed.toFixed(0)} ms`).toBeLessThan(LIMIT_MS);
    },
    LIMIT_MS * 3,
  );
});
