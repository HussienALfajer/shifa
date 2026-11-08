import { dbTestProject } from '@shifa/db/vitest.db.config';
import { defineConfig } from 'vitest/config';

// Tests that never reach PostgreSQL run without Docker; the rest use the @shifa/db harness.
const unit = [
  'test/config.test.ts',
  'test/config-host-env.test.ts',
  'test/logging.test.ts',
  'test/logging-sanitise.test.ts',
];

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: unit } },
      dbTestProject({ name: 'db', exclude: unit }),
    ],
  },
});
