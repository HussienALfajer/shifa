// The two ways the application reaches PostgreSQL (0.3-S2a): directly, and through PgBouncer in
// transaction mode. Isolation tests run once per mode.
import type { ShifaDb } from '../../src/client.ts';
import { pooledTestDb, testDb } from '../../test-harness/index.ts';

export const DB_MODES: readonly (readonly [mode: 'direct' | 'pgbouncer', db: () => ShifaDb])[] = [
  ['direct', () => testDb()],
  ['pgbouncer', () => pooledTestDb()],
];
