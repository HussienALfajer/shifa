// A-01a criterion 16 (backlog "routes outside the guard"): every route Fastify serves is a Nest
// controller route, so it passes the global guard and the contract check. A raw `fastify.get()`
// (or a plugin's route, a static file server, a docs UI) would skip both and look like a public
// row in the matrix: this test fails on any.
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { ContractCheck } from '../../src/platform/contract/contract-check.ts';
import { buildTestApp, offlineDb, type TestApp } from '../support.ts';

let current: TestApp | undefined;

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

/** Routes Fastify registered that no controller handler declares. */
function routesOutsideNest(app: NestFastifyApplication, registered: readonly string[]): string[] {
  const declared = new Set(
    app
      .get(ContractCheck)
      .routes()
      .flatMap((handler) => handler.paths.map((path) => `${handler.method ?? 'ALL'} ${path}`)),
  );
  return registered.filter((route) => !declared.has(route)).sort();
}

describe('routes outside the guard', () => {
  it('the production app serves controller routes only', async () => {
    current = await buildTestApp({ db: offlineDb() });
    expect(current.routes.length).toBeGreaterThan(0);
    expect(routesOutsideNest(current.app, current.routes)).toEqual([]);
  });

  it('red: a raw Fastify route is reported', async () => {
    current = await buildTestApp({
      db: offlineDb(),
      beforeInit: (fastify) => {
        fastify.get('/raw-outside-guard', () => ({ leaked: true }));
      },
    });
    expect(routesOutsideNest(current.app, current.routes)).toEqual(['GET /raw-outside-guard']);
  });
});
