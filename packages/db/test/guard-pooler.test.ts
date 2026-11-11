// Unit tests: through PgBouncer the guard accepts only the worker clones and the console, never
// the template or the maintenance database (0.3-S2a review: an idle pooled server connection on
// shifa_template would block every later clone). No Docker needed.
import { describe, expect, it } from 'vitest';
import { assertTestTarget, UnsafeDatabaseError } from '../test-harness/guard.ts';
import { pgbouncerIni } from '../test-harness/pgbouncer.ts';

describe('pgbouncerIni()', () => {
  it('leaves server_reset_query_always off by default and turns it on for the variant', () => {
    expect(pgbouncerIni()).not.toMatch(/server_reset_query/);
    const variant = pgbouncerIni({ resetAlways: true });
    expect(variant).toMatch(/^server_reset_query = DISCARD ALL$/m);
    expect(variant).toMatch(/^server_reset_query_always = 1$/m);
    expect(variant).toMatch(/^pool_mode = transaction$/m);
  });
});

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

  it('treats the reset-always PgBouncer (0.3-S2b) like the shared one', () => {
    const both = { ...harness, resetPooler: { host: 'localhost', port: 57432 } };
    expect(() => {
      assertTestTarget('postgres://u:pw@localhost:57432/shifa_test_9994', both);
    }).not.toThrow();
    for (const db of ['shifa_template', 'postgres']) {
      expect(() => {
        assertTestTarget(`postgres://u:pw@localhost:57432/${db}`, both);
      }).toThrow(UnsafeDatabaseError);
    }
    // Without the second pooler started, its port is just an unknown port.
    expect(() => {
      assertTestTarget('postgres://u:pw@localhost:57432/shifa_test_1', harness);
    }).toThrow(UnsafeDatabaseError);
  });

  it('still accepts the template and the maintenance database directly', () => {
    for (const db of ['shifa_template', 'postgres']) {
      expect(() => {
        assertTestTarget(`postgres://u:pw@localhost:55432/${db}`, harness);
      }).not.toThrow();
    }
  });
});
