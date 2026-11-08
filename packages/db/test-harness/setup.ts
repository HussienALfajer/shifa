// Vitest setupFiles entry: before each test file, make sure this worker's database exists and
// is empty; after it, close the file's pools.
import { afterAll, beforeAll } from 'vitest';
import { closeTestConnections, ensureWorkerDatabase, resetTestDb } from './index.ts';

beforeAll(async () => {
  await ensureWorkerDatabase();
  await resetTestDb();
});

afterAll(closeTestConnections);
