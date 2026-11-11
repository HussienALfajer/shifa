// Calls every registered route as every caller and compares the status class with the committed
// matrix. Red cases run the same comparison against mutated copies of the matrix.
import { testDb } from '@shifa/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NoAuthAdapter } from '../../src/access/auth.port.ts';
import { ROLES } from '../../src/access/roles.ts';
import {
  HeaderAuthAdapter,
  headersFor,
  ProbeController,
  principalFor,
  TEST_GRANTS,
} from '../access/probe.ts';
import { buildTestApp, type TestApp } from '../support.ts';
import {
  type Caller,
  EXPECTED_MATRIX,
  type Matrix,
  type MatrixRow,
  TEST_ONLY_ROUTES,
} from './route-matrix.expected.ts';

const CALLERS: readonly Caller[] = ['anonymous', ...ROLES];

/** Observed status classes; any number, so unexpected statuses show up in the diff. */
type Observed = Record<string, Record<Caller, number>>;

function statusClass(status: number): number {
  if (status >= 200 && status < 300) return 200;
  return status;
}

async function observe(app: TestApp): Promise<Observed> {
  const observed: Observed = {};
  for (const route of app.routes) {
    const [method, url] = route.split(' ') as [string, string];
    const row = {} as Record<Caller, number>;
    for (const caller of CALLERS) {
      const headers = caller === 'anonymous' ? {} : headersFor(principalFor(caller));
      const res = await app.app.inject({ method: method as 'GET', url, headers });
      row[caller] = statusClass(res.statusCode);
    }
    observed[route] = row;
  }
  return observed;
}

/** Every difference between what the routes answer and what the matrix expects. */
export function diffMatrix(observed: Observed, expected: Matrix): string[] {
  const problems: string[] = [];
  for (const route of Object.keys(observed)) {
    const row: MatrixRow | undefined = expected[route];
    if (!row) {
      problems.push(`route without a row: ${route}`);
      continue;
    }
    for (const caller of CALLERS) {
      const got = observed[route]?.[caller];
      if (got !== row[caller]) {
        problems.push(`${route} as ${caller}: expected ${String(row[caller])}, got ${String(got)}`);
      }
    }
  }
  for (const route of Object.keys(expected)) {
    if (!(route in observed)) problems.push(`row without a route: ${route}`);
  }
  return problems;
}

function rowOf(route: string): MatrixRow {
  const row = EXPECTED_MATRIX[route];
  if (!row) throw new Error(`no row for ${route}`);
  return row;
}

let withTestAuth: TestApp;
let withProductionAuth: TestApp;
let observed: Observed;

beforeAll(async () => {
  withTestAuth = await buildTestApp({
    db: testDb(),
    controllers: [ProbeController],
    auth: new HeaderAuthAdapter(),
    grants: TEST_GRANTS,
    testRoutes: true,
  });
  withProductionAuth = await buildTestApp({
    db: testDb(),
    controllers: [ProbeController],
    testRoutes: true,
  });
  observed = await observe(withTestAuth);
});

afterAll(async () => {
  await withTestAuth.app.close();
  await withProductionAuth.app.close();
});

describe('route permission matrix', () => {
  it('finds the routes it must cover', () => {
    expect(withTestAuth.routes).toContain('GET /health/live');
    expect(withTestAuth.routes).toContain('GET /__probe/read');
  });

  it('matches the committed matrix', () => {
    expect(diffMatrix(observed, EXPECTED_MATRIX)).toEqual([]);
  });

  it('production auth: every protected route answers 401 to every caller', async () => {
    expect(NoAuthAdapter).toBeDefined();
    const production = await observe(withProductionAuth);
    for (const [route, row] of Object.entries(EXPECTED_MATRIX)) {
      for (const caller of CALLERS) {
        const want = row.anonymous === 401 ? 401 : row[caller];
        expect(`${route} as ${caller}: ${String(production[route]?.[caller])}`).toBe(
          `${route} as ${caller}: ${String(want)}`,
        );
      }
    }
  });

  it('test-only routes are covered here and absent from an app built without them', async () => {
    for (const route of TEST_ONLY_ROUTES) expect(withTestAuth.routes).toContain(route);
    const production = await buildTestApp({ db: testDb() });
    try {
      for (const route of TEST_ONLY_ROUTES) expect(production.routes).not.toContain(route);
    } finally {
      await production.app.close();
    }
  });

  it('red: a route without a row fails', () => {
    const rest: Matrix = Object.fromEntries(
      Object.entries(EXPECTED_MATRIX).filter(([route]) => route !== 'GET /__probe/read'),
    );
    expect(diffMatrix(observed, rest)).toEqual(['route without a row: GET /__probe/read']);
  });

  it('red: a row without a route fails', () => {
    const extra: Matrix = {
      ...EXPECTED_MATRIX,
      'GET /__probe/gone': rowOf('GET /health/live'),
    };
    expect(diffMatrix(observed, extra)).toEqual(['row without a route: GET /__probe/gone']);
  });

  it('red: a changed expected status fails', () => {
    const read = rowOf('GET /__probe/read');
    const changed: Matrix = {
      ...EXPECTED_MATRIX,
      'GET /__probe/read': { ...read, assistant: 200 },
    };
    expect(diffMatrix(observed, changed)).toEqual([
      'GET /__probe/read as assistant: expected 200, got 403',
    ]);
  });
});
