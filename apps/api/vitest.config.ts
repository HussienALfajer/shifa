import { dbTestProject } from '@shifa/db/vitest.db.config';
import { defineConfig } from 'vitest/config';

// Tests that never reach PostgreSQL run without Docker; the rest use the @shifa/db harness.
const unit = [
  'test/config.test.ts',
  'test/config-host-env.test.ts',
  'test/config-identity.test.ts',
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
  'test/telemetry/scrub-review.test.ts',
  'test/telemetry/scrub-security.test.ts',
  'test/telemetry/error-config.test.ts',
  'test/telemetry/test-route.test.ts',
  'test/telemetry/error-transport.test.ts',
  'test/telemetry/stack-strict.test.ts',
  'test/obs-smoke-parse.test.ts',
  'test/identity/password-rules.test.ts',
  'test/identity/ip-key.test.ts',
  'test/telemetry/sampler.test.ts',
  'test/access/principal-schema.test.ts',
  'test/access/support-principal.test.ts',
  'test/architecture/raw-routes.test.ts',
  'test/contract/openapi-meta-schema.test.ts',
  'test/entitlements/resolve.test.ts',
  'test/entitlements/catalogue.test.ts',
  'test/entitlements/cache.test.ts',
  'test/flags/evaluate.test.ts',
  'test/flags/cache.test.ts',
  'test/flags/catalogue.test.ts',
  'test/settings/resolve.test.ts',
  'test/settings/catalogue.test.ts',
  'test/patients/birth.test.ts',
];

// Telemetry integration tests opt in to the SDK: their setup file installs the http and pg
// instrumentations before the database harness (or anything else) loads those modules.
const telemetry = [
  'test/telemetry/tracing.test.ts',
  'test/telemetry/metrics.test.ts',
  'test/telemetry/log-correlation.test.ts',
  'test/telemetry/telemetry-leak.test.ts',
  'test/telemetry/tracestate-leak.test.ts',
  'test/telemetry/error-reporting.test.ts',
  'test/telemetry/error-frames.test.ts',
  'test/telemetry/sampling.test.ts',
  'test/telemetry/request-id-export.test.ts',
  'test/telemetry/identity-leak.test.ts',
  // A-03-02 security review L2: with the SDK set up first, the leak test sees query spans too.
  'test/telemetry/patients-leak.test.ts',
  // A-03-03 review 5: search terms, with query spans recorded.
  'test/telemetry/patients-search-leak.test.ts',
];

// The identity tests sign in up to 30 times per case, and every attempt verifies a scrypt hash on
// purpose (criterion 6): on a loaded runner that outlasts the harness's 20 s default. Hooks get
// the same: the route matrix signs in every caller for every route in its `beforeAll` (about 20 s
// alone, past 60 s in CI beside the other files).
const IDENTITY_TEST_TIMEOUT_MS = 90_000;
const withIdentityTimeout = (project: ReturnType<typeof dbTestProject>) =>
  ({
    ...project,
    test: {
      ...project.test,
      testTimeout: IDENTITY_TEST_TIMEOUT_MS,
      hookTimeout: IDENTITY_TEST_TIMEOUT_MS,
    },
  }) as ReturnType<typeof dbTestProject>;
const db = withIdentityTimeout(dbTestProject({ name: 'db', exclude: [...unit, ...telemetry] }));
const telemetryProject = withIdentityTimeout(
  dbTestProject({ name: 'telemetry', include: telemetry }),
);

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
