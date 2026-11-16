import { dbTestProject } from '@shifa/db/vitest.db.config';
import { defineConfig } from 'vitest/config';

// Pure normaliser tests, plus the PostgreSQL 18 tests (Testcontainers through @shifa/db).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 's3-normaliser',
          include: [
            'test/vectors.test.ts',
            'test/parity-vectors.test.ts',
            'test/od40-merges.test.ts',
          ],
        },
      },
      dbTestProject({
        name: 's3-search-db',
        include: ['test/search.test.ts', 'test/key-drift.test.ts', 'test/schema.test.ts'],
      }),
    ],
  },
});
