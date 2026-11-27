// A-02-05 criterion 12, enforced twice: every route of the API called from a real support tab (the
// production AuthPort and cookie). Expected statuses come from the reviewed route matrix: a GET
// answers what an owner gets, except @PlatformAdmin routes (403); every other method answers 403
// `support_read_only` before the handler, `@SignedIn` account writes included, except
// `POST /auth/support/end`; public routes act as nobody and are left out. Then a write forced past
// the guard (a GET that writes) fails on the READ ONLY transaction.
import { Controller, Get, Inject } from '@nestjs/common';
import { branch } from '@shifa/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CurrentScope,
  type RequestScope,
  RequirePermission,
  TenantDb,
} from '../../src/access/index.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { EXPECTED_MATRIX } from '../architecture/route-matrix.expected.ts';
import { errorCode } from '../platform/support.ts';
import { testContract } from '../support.ts';
import {
  grantRow,
  request,
  supportAuditRows,
  supportTab,
  supportWorld,
  type World,
} from './support.ts';

/** A route that writes although it is a GET: only the database stops it in a support session. */
@Controller('__support_probe')
class ForcedWriteController {
  constructor(@Inject(TenantDb) private readonly tenantDb: TenantDb) {}

  @RequirePermission('clinic.settings.manage')
  @Contract(testContract('GET', '/__support_probe/write'))
  @Get('write')
  async write(@CurrentScope() scope: RequestScope): Promise<{ ok: true }> {
    await this.tenantDb.run(scope, (tx) =>
      tx.insert(branch).values({ tenantId: scope.tenantId, name: 'فرع مكتوب' }),
    );
    return { ok: true };
  }
}

const ALLOWED_WRITE = 'POST /auth/support/end';
const READS = new Set(['GET', 'HEAD']);
const ANY_ID = '00000000-0000-4000-8000-0000000000ff';

let world: World;
let tab: string;
let grantId: string;
/** Real ids for owner GETs with a path parameter, so they show access, not 404. */
const samples = new Map<string, string>();

beforeAll(async () => {
  world = await supportWorld({ controllers: [ForcedWriteController] });
  ({ tab, grantId } = await supportTab(world));
  const members = await request(world, 'GET', '/team/members', world.owner);
  const memberId = members.json<{ members: { id: string }[] }>().members[0]?.id ?? ANY_ID;
  const branches = await request(world, 'GET', '/branches', world.owner);
  const branchId = branches.json<{ active: { id: string }[] }>().active[0]?.id ?? ANY_ID;
  samples.set('GET /team/members/:id', `/team/members/${memberId}`);
  samples.set('GET /branches/:id/archive-preview', `/branches/${branchId}/archive-preview`);
});

afterAll(async () => {
  await world.app.app.close();
});

/** What the route answers a support session, from the reviewed matrix; null: left out. */
function expected(route: string): { status: number; code?: string } | null {
  const row = EXPECTED_MATRIX[route];
  if (!row) throw new Error(`no matrix row for ${route}`);
  if (row.anonymous !== 401) return null; // public: acts as nobody
  const [method = ''] = route.split(' ');
  if (route === ALLOWED_WRITE) return null; // ends the grant: its own test
  if (!READS.has(method)) return { status: 403, code: 'support_read_only' };
  // The super admin belongs to no clinic: their own chooser has nothing to list (as for any super
  // admin; the route matrix shows 200 with an invitation).
  if (route === 'GET /me/clinics') return { status: 404, code: 'no_clinic' };
  const platformOnly = row.platform_admin === 200 && row.owner === 403;
  return { status: platformOnly ? 403 : row.owner };
}

const urlOf = (route: string) =>
  samples.get(route) ??
  (route.split(' ')[1] ?? '').replace(/:key/g, 'session.idle_minutes').replace(/:id/g, ANY_ID);

describe('every route in a support session (criterion 12)', () => {
  it('answers a GET as an owner, refuses platform routes and every write', async () => {
    const problems: string[] = [];
    let called = 0;
    for (const route of world.app.routes) {
      if (route.includes('/__support_probe')) continue;
      const want = expected(route);
      if (!want) continue;
      const [method = 'GET'] = route.split(' ');
      const res = await request(world, method as 'GET', urlOf(route), tab);
      called += 1;
      const status = res.statusCode >= 200 && res.statusCode < 300 ? 200 : res.statusCode;
      if (status !== want.status || (want.code && errorCode(res) !== want.code)) {
        problems.push(`${route}: expected ${String(want.status)}, got ${String(res.statusCode)}`);
      }
    }
    expect(problems).toEqual([]);
    expect(called).toBeGreaterThan(40);
    // Every one of them was audited, refused ones too; the grant is still open.
    const audited = (await supportAuditRows()).filter((r) => r.event === 'support.request');
    expect(audited.length).toBeGreaterThanOrEqual(called);
    expect((await grantRow(grantId))?.endedAt).toBeNull();
  });

  it('the matrix covers both kinds: some writes are @SignedIn account routes', () => {
    const signedInWrites = Object.entries(EXPECTED_MATRIX).filter(
      ([route, row]) =>
        !READS.has(route.split(' ')[0] ?? '') && row.anonymous === 401 && row.doctor === 200,
    );
    expect(signedInWrites.map(([r]) => r)).toContain('POST /auth/sign-out');
  });
});

describe('a write forced past the guard (criterion 12, the second wall)', () => {
  it('fails on the READ ONLY transaction in a support session, and works for the owner', async () => {
    const forced = await request(world, 'GET', '/__support_probe/write', tab);
    expect(forced.statusCode).toBe(500);
    const before = await request(world, 'GET', '/branches', world.owner);
    const count = before.json<{ active: unknown[] }>().active.length;
    const owner = await request(world, 'GET', '/__support_probe/write', world.owner);
    expect(owner.statusCode).toBe(200);
    const after = await request(world, 'GET', '/branches', world.owner);
    expect(after.json<{ active: unknown[] }>().active.length).toBe(count + 1);
  });
});
