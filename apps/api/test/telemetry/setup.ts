// Vitest setupFiles entry of the `telemetry` project, listed before the database harness: the
// http and pg instrumentations must patch those modules before Fastify or @shifa/db load them,
// exactly as dist/instrument.js does before dist/main.js in production.
import { installInstrumentations } from '../../src/telemetry/sdk.ts';

installInstrumentations();
