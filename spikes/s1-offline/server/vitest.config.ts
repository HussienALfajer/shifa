import { dbTestProject } from '@shifa/db/vitest.db.config';
import { defineConfig } from 'vitest/config';

// Every server test runs the command handler against real PostgreSQL (Testcontainers).
export default defineConfig({
  test: {
    projects: [dbTestProject({ name: 's1-server', include: ['test/**/*.test.ts'] })],
  },
});
