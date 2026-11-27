// Process entry point (bootstrap only): config, logger, database, app, signals.
import {
  createAuthDb,
  createDb,
  createPlatformDb,
  entitlementKeysInUse,
  settingKeysInUse,
  user,
} from '@shifa/db';
import { createApp } from './app.ts';
import { ConfigError, loadConfig, loadIdentityConfig } from './config/env.ts';
import {
  assertEntitlementKeysKnown,
  EntitlementCatalogue,
  PRODUCTION_ENTITLEMENTS,
} from './modules/entitlements/index.ts';
import {
  assertSettingKeysKnown,
  PRODUCTION_SETTINGS,
  SettingCatalogue,
} from './modules/settings/index.ts';
import { describeError, errorClass } from './platform/errors.ts';
import { createLogger } from './platform/logging.ts';
import { flushErrors, reportError } from './telemetry/errors.ts';
import { otlpLogForwarder } from './telemetry/logs.ts';

/** In-flight requests get this long after SIGTERM/SIGINT before the process gives up. */
const DRAIN_MS = 10_000;
/** A crash waits this long for its error event to be sent before the process exits. */
const CRASH_FLUSH_MS = 2000;
const SIGNALS = ['SIGTERM', 'SIGINT'] as const;

function readConfig() {
  try {
    return { ...loadConfig(process.env), identity: loadIdentityConfig(process.env) };
  } catch (err) {
    // Before the logger exists. ConfigError messages name keys only, never values.
    const message = err instanceof ConfigError ? err.message : 'configuration failed';
    process.stderr.write(`shifa-api: ${message}\n`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const config = readConfig();
  // Telemetry was started by dist/instrument.js (--import) when the endpoint is set.
  const logger = createLogger({
    level: config.logLevel,
    ...(config.telemetry.endpoint === undefined ? {} : { forward: otlpLogForwarder() }),
  });
  // Once only: stop taking connections, report, wait briefly for the event, exit.
  const state: { crashing: boolean; server?: { close(): unknown } } = { crashing: false };
  const crash = (what: string) => (reason: unknown) => {
    if (state.crashing) return;
    state.crashing = true;
    state.server?.close();
    logger.fatal({ err: describeError(reason) }, what);
    reportError(reason, errorClass(reason));
    void flushErrors(CRASH_FLUSH_MS).finally(() => process.exit(1));
  };
  process.on('unhandledRejection', crash('unhandled rejection'));
  process.on('uncaughtException', crash('uncaught exception'));

  const db = createDb(config.databaseUrl, {
    onIdleError: (err) => {
      logger.warn({ err: describeError(err) }, 'idle database connection failed');
    },
  });
  const authDb = createAuthDb(config.identity.databaseUrlAuth, {
    onIdleError: (err) => {
      logger.warn({ err: describeError(err) }, 'idle identity database connection failed');
    },
  });
  // Opened lazily: its first use is a super admin's request (every call writes an audit row, so
  // there is no read-only start-up probe on this pool).
  const platformDb = createPlatformDb(config.identity.databaseUrlPlatform, {
    onIdleError: (err) => {
      logger.warn({ err: describeError(err) }, 'idle platform database connection failed');
    },
  });
  // Fail fast: each factory refuses any role but its own (owner, superuser, BYPASSRLS) on first use.
  try {
    await db.ping();
    await authDb.withAuth((tx) => tx.select({ id: user.id }).from(user).limit(1));
    // A-02 criterion 2: a key the plans or add-ons hold that the catalogue does not list.
    assertEntitlementKeysKnown(
      new EntitlementCatalogue(PRODUCTION_ENTITLEMENTS),
      await entitlementKeysInUse(db),
    );
    // A-02 criterion 8: a platform or plan setting value for a key the code does not declare.
    assertSettingKeysKnown(new SettingCatalogue(PRODUCTION_SETTINGS), await settingKeysInUse(db));
  } catch (err) {
    logger.fatal({ err: describeError(err) }, 'database check failed at startup');
    await db.close().catch(() => undefined);
    await authDb.close().catch(() => undefined);
    await platformDb.close().catch(() => undefined);
    process.exit(1);
  }

  const app = await createApp({
    db,
    authDb,
    platformDb,
    clinicWebUrl: config.identity.clinicWebUrl,
    secrets: {
      betterAuthSecret: config.identity.betterAuthSecret,
      hmacKey: config.identity.hmacKey,
    },
    logger,
    testRoutes: config.testRoutes,
  });
  state.server = app.getHttpServer();
  if (config.testRoutes) logger.warn('NODE_ENV=test: test-only routes are registered');
  app.enableShutdownHooks([...SIGNALS], { useProcessExit: true });
  for (const signal of SIGNALS) {
    process.once(signal, () => {
      logger.info({ signal }, 'shutting down');
      setTimeout(() => {
        logger.error('shutdown did not finish in time');
        process.exit(1);
      }, DRAIN_MS).unref();
    });
  }
  await app.listen({ port: config.port, host: config.host });
  logger.info({ host: config.host, port: config.port }, 'api listening');
}

await main();
