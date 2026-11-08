// Cross-tenant isolation suite (0.2-06b, ADR-0004): every tenant table in the classification
// has a registered case, and every case's read and write paths stay inside their tenant.
import { describe, expect, it } from 'vitest';
import { TABLE_CLASSIFICATION } from '../../src/schema/classification.ts';
import { testDb } from '../../test-harness/index.ts';
import { ISOLATION_CASES } from './cases/index.ts';
import { coverageGaps, runIsolationCase } from './runner.ts';

describe('cross-tenant isolation', () => {
  it('every tenant table has an isolation case', () => {
    expect(coverageGaps(TABLE_CLASSIFICATION, ISOLATION_CASES)).toEqual([]);
  });

  for (const isolationCase of ISOLATION_CASES) {
    it(`${isolationCase.table} leaks no rows to another tenant`, async () => {
      expect(await runIsolationCase(testDb(), isolationCase)).toEqual([]);
    });
  }
});
