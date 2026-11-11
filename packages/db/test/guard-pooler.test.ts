// Unit tests: through PgBouncer the guard accepts only the worker clones and the console, never
// the template or the maintenance database (0.3-S2a review: an idle pooled server connection on
// shifa_template would block every later clone). No Docker needed.
import { describe, expect, it } from 'vitest';
import { assertTestTarget, UnsafeDatabaseError } from '../test-harness/guard.ts';

const harness = { host: 'localhost', port: 55432, pooler: { host: 'localhost', port: 56432 } };

describe('assertTestTarget through the pooler', () => {
  it('accepts the worker clones and the PgBouncer console', () => {
    for (const db of ['shifa_test_1', 'shifa_test_9994', 'pgbouncer']) {
      expect(() => {
        assertTestTarget(`postgres://u:pw@localhost:56432/${db}`, harness);
      }).not.toThrow();
    }
  });

  it('refuses the template and the maintenance database', () => {
    for (const db of ['shifa_template', 'postgres', 'shifa']) {
      expect(() => {
        assertTestTarget(`postgres://u:pw@localhost:56432/${db}`, harness);
      }).toThrow(UnsafeDatabaseError);
    }
  });

  it('still accepts the template and the maintenance database directly', () => {
    for (const db of ['shifa_template', 'postgres']) {
      expect(() => {
        assertTestTarget(`postgres://u:pw@localhost:55432/${db}`, harness);
      }).not.toThrow();
    }
  });
});
