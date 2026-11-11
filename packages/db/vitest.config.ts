import { defineConfig } from 'vitest/config';
import { dbTestProject } from './vitest.db.config.ts';

// Unit tests of the harness itself need no Docker; everything else runs against PostgreSQL.
const unit = [
  'test/guard.test.ts',
  'test/docker.test.ts',
  'test/lock-reentry.test.ts',
  'test/backup-drill-report.test.ts',
];

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: unit } },
      dbTestProject({ name: 'db', exclude: unit }),
    ],
  },
});
