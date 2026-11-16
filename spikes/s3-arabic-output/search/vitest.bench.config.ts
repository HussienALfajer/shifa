import { dbTestProject } from '@shifa/db/vitest.db.config';
import { defineConfig } from 'vitest/config';

// `bench:search`: the search bench as a Vitest run, so it gets the @shifa/db harness.
export default defineConfig({
  test: {
    projects: [
      dbTestProject({ name: 's3-search-bench', include: ['scripts/bench-search.test.ts'] }),
    ],
  },
});
