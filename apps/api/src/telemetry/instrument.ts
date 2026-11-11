// Second build entry, loaded first: `node --import ./dist/instrument.js dist/main.js`. The http
// and pg instrumentations must patch those modules before main.ts imports Fastify and pg.
import { readFileSync } from 'node:fs';
import { bootstrapErrorReporting, bootstrapTelemetry } from './bootstrap.ts';

function packageVersion(): string {
  try {
    const url = new URL('../package.json', import.meta.url); // dist/ → apps/api/package.json
    const { version } = JSON.parse(readFileSync(url, 'utf8')) as { version?: unknown };
    return typeof version === 'string' ? version : 'unknown';
  } catch {
    return 'unknown';
  }
}

const version = packageVersion();
await bootstrapTelemetry(process.env, version);
bootstrapErrorReporting(process.env, version);
