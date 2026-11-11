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
  'test/contract/hardening.test.ts',
  'test/telemetry/scrub.test.ts',
  'test/telemetry/telemetry-config.test.ts',
];

// Telemetry integration tests opt in to the SDK: their setup file installs the http and pg
// instrumentations before the database harness (or anything else) loads those modules.
const telemetry = [
  'test/telemetry/tracing.test.ts',
  'test/telemetry/metrics.test.ts',
  'test/telemetry/log-correlation.test.ts',
  'test/telemetry/telemetry-leak.test.ts',
];

const db = dbTestProject({ name: 'db', exclude: [...unit, ...telemetry] });
const telemetryProject = dbTestProject({ name: 'telemetry', include: telemetry });

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: unit } },
      db,
      {
        ...telemetryProject,
        test: {
          ...telemetryProject.test,
          setupFiles: [
            'test/telemetry/setup.ts',
            ...[telemetryProject.test?.setupFiles ?? []].flat(),
          ],
        },
      },
    ],
  },
});
