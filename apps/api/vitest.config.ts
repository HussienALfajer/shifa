import { dbTestProject } from '@shifa/db/vitest.db.config';
import { defineConfig } from 'vitest/config';

// Tests that never reach PostgreSQL run without Docker; the rest use the @shifa/db harness.
const unit = [
  'test/config.test.ts',
  'test/config-host-env.test.ts',
  'test/logging.test.ts',
  'test/logging-sanitise.test.ts',
  'test/framework-errors.test.ts',
  'test/access/access-check.test.ts',
  'test/access/guard.test.ts',
  'test/access/principal.test.ts',
  'test/access/test-support.test.ts',
  'test/architecture/module-imports.test.ts',
  'test/contract/contract-check.test.ts',
  'test/contract/validation.test.ts',
  'test/contract/openapi.test.ts',
];

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: unit } },
      dbTestProject({ name: 'db', exclude: unit }),
    ],
  },
});
