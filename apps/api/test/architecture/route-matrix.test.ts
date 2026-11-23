// Calls every registered route as every caller and compares the status class with the committed
// matrix. Red cases run the same comparison against mutated copies of the matrix.
import { randomBytes, randomUUID } from 'node:crypto';
import { createClinic, membership, roleAssignment, session, setupLink, twoFactor } from '@shifa/db';
import {
  createTestTenants,
  fixtureId,
  syntheticPhones,
  testAuthDb,
  testDb,
  testPlatformDb,
} from '@shifa/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUTH_PORT } from '../../src/access/auth.port.ts';
import { ROLES, type Role } from '../../src/access/roles.ts';
import { BetterAuthAdapter } from '../../src/modules/identity/index.ts';
import { newLinkToken } from '../../src/modules/identity/links.ts';
import { sealSecret } from '../../src/modules/identity/secret-box.ts';
import { base32Encode } from '../../src/modules/identity/totp.ts';
import { ContractCheck } from '../../src/platform/contract/contract-check.ts';
import {
  HeaderAuthAdapter,
  headersFor,
  ProbeController,
  principalFor,
  TENANT_A,
  TENANT_B,
  TEST_GRANTS,
  TEST_PERMISSIONS,
} from '../access/probe.ts';
import { PASSWORD, seedPerson } from '../identity/support.ts';
import { totpAt } from '../identity/totp.ts';
import { buildTestApp, TEST_SECRETS, type TestApp } from '../support.ts';
import {
  type Caller,
  EXPECTED_MATRIX,
  type Matrix,
  type MatrixRow,
  SAMPLE_REQUESTS,
  type SampleContext,
  TEST_ONLY_ROUTES,
} from './route-matrix.expected.ts';

const CALLERS: readonly Caller[] = ['anonymous', ...ROLES];

/** Observed status classes; any number, so unexpected statuses show up in the diff. */
type Observed = Record<string, Record<Caller, number>>;

function statusClass(status: number): number {
  if (status >= 200 && status < 300) return 200;
  return status;
}

/** One synthetic person per role, and one who signs in through the sample body. */
const people = new Map<Caller, string>();
let signInPerson: SampleContext['signIn'];
let clinicId: string;

/** Fresh phones for clinic owners and links (a used link's phone has an account). */
const spare = syntheticPhones(2026_11_28, 200);
let spareIndex = 0;
const nextPhone = () => {
  const phone = spare[spareIndex];
  spareIndex += 1;
  if (!phone) throw new Error('out of spare phones');
  return phone;
};

/** A clinic with a pending owner and a fresh link; returns the link's token. */
async function clinicWithLink(): Promise<{ clinicId: string; token: string }> {
  const { token, hash } = newLinkToken();
  const created = await testPlatformDb().withPlatformAdmin(
    { actorId: fixtureId('matrix super admin'), event: 'clinic.created' },
    (tx) =>
      createClinic(tx, {
        name: 'عيادة المصفوفة',
        type: 'solo',
        owner: {
          displayName: 'مالك المصفوفة',
          phoneE164: nextPhone(),
          link: {
            purpose: 'owner_setup',
            tokenHash: hash,
            expiresAt: new Date(Date.now() + 3_600_000),
          },
        },
      }),
  );
  return { clinicId: created.tenantId, token };
}

/** A known TOTP key, so the matrix can send a valid code. */
const TOTP_KEY = Buffer.alloc(20, 7);

/** Puts `userId`'s TOTP in `state` and returns the current code. */
async function totpState(
  userId: string | undefined,
  state: 'none' | 'unconfirmed' | 'enrolled',
): Promise<string> {
  const code = totpAt(base32Encode(TOTP_KEY), new Date());
  if (userId === undefined) return code;
  await testAuthDb().withAuth(async (tx) => {
    await tx.delete(twoFactor).where(eq(twoFactor.userId, userId));
    if (state === 'none') return;
    await tx.insert(twoFactor).values({
      userId,
      secret: sealSecret(TOTP_KEY, TEST_SECRETS.betterAuthSecret),
      backupCodes: '[]',
      verified: state === 'enrolled',
      failedVerificationCount: 0,
    });
  });
  return code;
}

/** The phone of each seeded caller (invitations are for the caller's own phone). */
const phonesOf = new Map<Caller, string>();

/** A fresh member of the callers' clinic (A-01-04 routes). */
async function memberOfTenantA(status: 'pending' | 'deactivated' = 'pending'): Promise<string> {
  const id = randomUUID();
  // Every membership is inserted pending (A-01-05), then deactivated as the team does.
  await testDb().withTenant(
    { tenantId: TENANT_A, userId: fixtureId('matrix seeder') },
    async (tx) => {
      await tx.insert(membership).values({
        id,
        tenantId: TENANT_A,
        phoneE164: nextPhone(),
        displayName: 'موظف المصفوفة',
      });
      if (status !== 'pending') {
        await tx.update(membership).set({ status }).where(eq(membership.id, id));
      }
    },
  );
  return id;
}

/**
 * A fresh invitation for `phone` (any phone for anonymous callers), in a new clinic each time:
 * a phone is a member of a clinic once.
 */
async function invitationFor(phone: string | undefined): Promise<string> {
  const { token, hash } = newLinkToken();
  const id = randomUUID();
  const { clinicId: tenantId } = await clinicWithLink();
  await testDb().withTenant({ tenantId, userId: fixtureId('matrix seeder') }, async (tx) => {
    await tx.insert(membership).values({
      id,
      tenantId,
      phoneE164: phone ?? nextPhone(),
      displayName: 'مدعو المصفوفة',
    });
    await tx.insert(roleAssignment).values({ tenantId, membershipId: id, role: 'doctor' });
    await tx.insert(setupLink).values({
      tenantId,
      membershipId: id,
      purpose: 'invitation',
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
  });
  return token;
}

async function seedPeople(): Promise<void> {
  // The callers' clinic (principalFor: TENANT_A) and a clinic that invites them (TENANT_B).
  await createTestTenants(TENANT_A, TENANT_B);
  const phones = syntheticPhones(2026_11_13, ROLES.length + 1);
  for (const [i, role] of ROLES.entries()) {
    people.set(role, (await seedPerson(phones[i] ?? '')).userId);
    phonesOf.set(role, phones[i] ?? '');
  }
  const phone = phones[ROLES.length] ?? '';
  await seedPerson(phone);
  signInPerson = { phone, password: PASSWORD };
}

/** A fresh session row for `userId` (the route under test may end it). */
async function newSession(userId: string): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  await testAuthDb().withAuth((tx) =>
    tx.insert(session).values({
      id,
      userId,
      token: randomBytes(24).toString('hex'),
      expiresAt: new Date(now.getTime() + 12 * 3_600_000),
      lastActiveAt: now,
    }),
  );
  return id;
}

async function observe(app: TestApp): Promise<Observed> {
  const observed: Observed = {};
  for (const route of app.routes) {
    const [method, url] = route.split(' ') as [string, string];
    const row = {} as Record<Caller, number>;
    for (const caller of CALLERS) {
      const userId = people.get(caller);
      const otherSessionId = userId === undefined ? randomUUID() : await newSession(userId);
      const ctx: SampleContext = {
        signIn: signInPerson,
        otherSessionId,
        clinicId,
        nextPhone,
        newLinkToken: async () => (await clinicWithLink()).token,
        totp: (state) => totpState(userId, state),
        memberId: (status) => memberOfTenantA(status),
        invitationToken: () => invitationFor(phonesOf.get(caller)),
      };
      const sample = (await SAMPLE_REQUESTS[route]?.(ctx)) ?? {};
      const headers =
        userId === undefined
          ? {}
          : headersFor(
              principalFor(caller as Role, {
                userId,
                sessionId: await newSession(userId),
                ...(sample.mfa ? { mfa: sample.mfa } : {}),
              }),
            );
      const res = await app.app.inject({
        method: method as 'GET',
        url: sample.url ?? url,
        headers,
        ...(sample.body === undefined ? {} : { payload: sample.body as Record<string, unknown> }),
      });
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
  await seedPeople();
  clinicId = (await clinicWithLink()).clinicId;
  withTestAuth = await buildTestApp({
    db: testDb(),
    authDb: testAuthDb(),
    platformDb: testPlatformDb(),
    controllers: [ProbeController],
    auth: new HeaderAuthAdapter(),
    grants: TEST_GRANTS,
    permissions: TEST_PERMISSIONS,
    testRoutes: true,
  });
  withProductionAuth = await buildTestApp({
    db: testDb(),
    authDb: testAuthDb(),
    platformDb: testPlatformDb(),
    controllers: [ProbeController],
    permissions: TEST_PERMISSIONS,
    testRoutes: true,
  });
  observed = await observe(withTestAuth);
});

afterAll(async () => {
  await withTestAuth.app.close();
  await withProductionAuth.app.close();
});

describe('route permission matrix', () => {
  it('every route with a request body or a path parameter has a sample request', () => {
    const needing = withTestAuth.app
      .get(ContractCheck)
      .routes()
      .filter((r) => r.contract?.request?.body !== undefined || r.contract?.request?.params)
      .map((r) => `${r.method ?? ''} ${r.paths[0] ?? ''}`)
      .filter((route) => !TEST_ONLY_ROUTES.has(route) && !route.includes('/__'));
    expect(needing).toContain('POST /auth/sign-in');
    for (const route of needing) expect(SAMPLE_REQUESTS[route], route).toBeDefined();
  });

  it('finds the routes it must cover', () => {
    expect(withTestAuth.routes).toContain('GET /health/live');
    expect(withTestAuth.routes).toContain('GET /__probe/read');
  });

  it('matches the committed matrix', () => {
    expect(diffMatrix(observed, EXPECTED_MATRIX)).toEqual([]);
  });

  it('production auth: every protected route answers 401 to every caller', async () => {
    expect(withProductionAuth.app.get(AUTH_PORT)).toBeInstanceOf(BetterAuthAdapter);
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

  it('500 is expected only on test-only routes', () => {
    for (const [route, row] of Object.entries(EXPECTED_MATRIX)) {
      if (TEST_ONLY_ROUTES.has(route)) continue;
      expect(Object.values(row), route).not.toContain(500);
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
