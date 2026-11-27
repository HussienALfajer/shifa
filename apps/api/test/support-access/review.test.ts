// A-02-05 review findings at the API: the expiry reaches the browser (1: the row and cookie outlive
// the grant, two requests in a row answer `support_ended` by `expiry`), the subscription card and
// the support log are refused to a support session (2), an upper-case path id keeps its audit
// target (4), the support cookie is cleared with the end and alone answers `ended` (7), a refused
// hand-off leaves a log line (11).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SUPPORT_COOKIE } from '../../src/modules/identity/index.ts';
import { post } from '../platform/support.ts';
import {
  exchange,
  handoffToken,
  opened,
  request,
  supportAuditRows,
  supportTab,
  supportWorld,
  type World,
} from './support.ts';

let world: World;

beforeEach(async () => {
  world = await supportWorld();
});

afterEach(async () => {
  await world.app.app.close();
});

interface Ended {
  error: { code: string; reason?: string; supportEnded?: { endedBy: string; endedAt: string } };
}

function setCookies(res: { headers: Record<string, string | string[] | number | undefined> }) {
  const raw = res.headers['set-cookie'];
  if (raw === undefined || typeof raw === 'number') return [];
  return Array.isArray(raw) ? raw : [raw];
}

const maxAgeOf = (line: string) => Number(/Max-Age=(\d+)/.exec(line)?.[1] ?? 'NaN');

describe('the expiry reaches the browser (review 1)', () => {
  it('the support cookie outlives the grant, and two requests after its end say expiry', async () => {
    const { handoffUrl } = await opened(world, 30);
    const res = await exchange(world, handoffToken(handoffUrl));
    const line = setCookies(res).find((l) => l.startsWith(`${SUPPORT_COOKIE}=`)) ?? '';
    expect(maxAgeOf(line)).toBeGreaterThan(30 * 60);
    const tab = line.split(';')[0] ?? '';
    world.clock.advanceBy(31 * 60_000);
    for (const url of ['/team/members', '/auth/session']) {
      const after = await request(world, 'GET', url, tab);
      expect(after.statusCode, url).toBe(401);
      expect(after.json<Ended>().error).toMatchObject({
        code: 'session_expired',
        reason: 'support_ended',
        supportEnded: { endedBy: 'expiry' },
      });
    }
  });
});

describe('owner reads kept from support (review 2)', () => {
  it('the subscription card and the support log answer 403 in a support session', async () => {
    const { tab } = await supportTab(world);
    for (const url of ['/clinic/subscription', '/clinic/support-grants']) {
      expect((await request(world, 'GET', url, tab)).statusCode, url).toBe(403);
      expect((await request(world, 'GET', url, world.owner)).statusCode, url).toBe(200);
    }
  });
});

describe('the audit target of an upper-case id (review 4)', () => {
  it('is stored lower-cased', async () => {
    const { tab } = await supportTab(world);
    const member = 'ABCDEF00-0000-4000-8000-0000000000EE';
    await request(world, 'GET', `/team/members/${member}`, tab);
    const row = (await supportAuditRows()).find(
      (r) => r.event === 'support.request' && r.data['route'] === '/team/members/:id',
    );
    expect(row?.targetId).toBe(member.toLowerCase());
  });
});

describe('the support cookie (review 7)', () => {
  it('is cleared with the answer that ends the tab, and with the end from the tab', async () => {
    const first = await supportTab(world);
    const end = await request(world, 'POST', '/auth/support/end', first.tab);
    expect(end.statusCode).toBe(204);
    expect(setCookies(end).some((l) => l.startsWith(`${SUPPORT_COOKIE}=;`))).toBe(true);
    const after = await request(world, 'GET', '/auth/session', first.tab);
    expect(after.json<Ended>().error.reason).toBe('support_ended');
    expect(setCookies(after).some((l) => l.startsWith(`${SUPPORT_COOKIE}=;`))).toBe(true);
  });

  it('alone, without its session row, answers session_expired ended (not anonymous)', async () => {
    const { tab, grantId } = await supportTab(world);
    // A new hand-off ends this tab's session row.
    const again = await post(
      world.app,
      `/platform/support-grants/${grantId}/handoff`,
      undefined,
      world.admin.cookie,
    );
    await exchange(world, handoffToken(again.json<{ handoffUrl: string }>().handoffUrl));
    const res = await request(world, 'GET', '/auth/session', tab);
    expect(res.statusCode).toBe(401);
    expect(res.json<Ended>().error).toMatchObject({ code: 'session_expired', reason: 'ended' });
    expect(setCookies(res).some((l) => l.startsWith(`${SUPPORT_COOKIE}=;`))).toBe(true);
    // With the owner's own clinic session beside it, the stale support cookie is ignored.
    const both = await request(world, 'GET', '/auth/session', `${tab}; ${world.owner}`);
    expect(both.statusCode).toBe(200);
  });
});

describe('a refused hand-off (review 11)', () => {
  it('logs the grant id and why, never the token', async () => {
    const { handoffUrl, grantId } = await opened(world);
    world.clock.advanceBy(2 * 60_000 + 1);
    const token = handoffToken(handoffUrl);
    expect((await exchange(world, token)).statusCode).toBe(404);
    const line = world.app.logs
      .records()
      .find((r) => r.msg === 'support hand-off refused' && r['grantId'] === grantId);
    expect(line?.['reason']).toBe('handoff_expired');
    expect(world.app.logs.text()).not.toContain(token);
  });
});
