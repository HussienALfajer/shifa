// Vitest setupFiles entry: before each test file, make sure this worker's database exists, holds
// only the migrated tables (no probe tables of an earlier file) and is empty; after it, close the
// file's pools.
import { afterAll, beforeAll } from 'vitest';
import {
  closeTestConnections,
  dropTestOnlyRelations,
  ensureWorkerDatabase,
  resetTestDb,
} from './index.ts';

beforeAll(async () => {
  await ensureWorkerDatabase();
  await dropTestOnlyRelations();
  await resetTestDb();
});

afterAll(closeTestConnections);
