// Process entry point (bootstrap only): config, logger, database, app, signals.
import { createDb } from '@shifa/db';
import { sql } from 'drizzle-orm';
import { createApp } from './app.ts';
import { ConfigError, loadConfig } from './config/env.ts';
import { describeError } from './platform/errors.ts';
import { createLogger } from './platform/logging.ts';

/** In-flight requests get this long after SIGTERM/SIGINT before the process gives up. */
const DRAIN_MS = 10_000;
const SIGNALS = ['SIGTERM', 'SIGINT'] as const;

function readConfig() {
  try {
    return loadConfig(process.env);
  } catch (err) {
    // Before the logger exists. ConfigError messages name keys only, never values.
    const message = err instanceof ConfigError ? err.message : 'configuration failed';
    process.stderr.write(`shifa-api: ${message}\n`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const config = readConfig();
  const logger = createLogger({ level: config.logLevel });
  const crash = (what: string) => (reason: unknown) => {
    logger.fatal({ err: describeError(reason) }, what);
    process.exit(1);
  };
  process.on('unhandledRejection', crash('unhandled rejection'));
  process.on('uncaughtException', crash('uncaught exception'));

  const db = createDb(config.databaseUrl, {
    onIdleError: (err) => {
      logger.warn({ err: describeError(err) }, 'idle database connection failed');
    },
  });
  // Fail fast: createDb() refuses an owner, superuser or BYPASSRLS role on first use.
  try {
    await db.withPlatformAdmin('startup-check', (tx) => tx.execute(sql`select 1`));
  } catch (err) {
    logger.fatal({ err: describeError(err) }, 'database check failed at startup');
    await db.close().catch(() => undefined);
    process.exit(1);
  }

  const app = await createApp({ db, logger });
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
