// A-02-05: the support session (criteria 11, 12, 14; ADR-0050; contract rows `session`, `refused`,
// `endedExpiry`, `endedOwner`, `endedSelf`, `endAsk` of the support session). The API journey:
// open → hand-off → owner reads 200 → a write 403 `support_read_only` → the owner ends it → 401
// `session_expired`, reason `support_ended`, with who and when. The hand-off is single-use and
// short-lived; three ways to end; one audit row per request without body or query; a suspended
// clinic stays readable; platform routes are refused; the reason never reaches a log.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SUPPORT_COOKIE } from '../../src/modules/identity/index.ts';
import { errorCode, patch, post } from '../platform/support.ts';
import {
  ageGrant,
  exchange,
  grantRow,
  handoffToken,
  opened,
  REASON,
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
  error: {
    code: string;
    reason?: string;
    supportEnded?: { endedBy: string; endedAt: string; ownerName: string | null };
  };
}

describe('the API journey (criteria 11–13)', () => {
  it('open, hand off, read as the owner, a write refused, the owner ends it, 401 support_ended', async () => {
    const { tab, grantId } = await supportTab(world);
    const session = await request(world, 'GET', '/auth/session', tab);
    expect(session.statusCode).toBe(200);
    expect(session.json()).toMatchObject({
      userId: world.admin.userId,
      platformAdmin: true,
      mfa: 'verified',
      tenantId: world.clinicId,
      roles: [{ role: 'owner', tenantId: world.clinicId, branchId: null }],
      support: {
        grantId,
        clinicName: 'عيادة الشفاء التخصصية',
        reason: REASON,
        now: world.clock.now().toISOString(),
      },
    });
    // Reads are those an owner may make.
    expect((await request(world, 'GET', '/team/members', tab)).statusCode).toBe(200);
    expect((await request(world, 'GET', '/clinic/settings', tab)).statusCode).toBe(200);
    // Every write answers 403 support_read_only, before the handler (no body needed).
    const write = await request(world, 'POST', '/branches', tab, { name: 'فرع الدعم' });
    expect(write.statusCode).toBe(403);
    expect(errorCode(write)).toBe('support_read_only');

    const end = await post(
      world.app,
      `/clinic/support-grants/${grantId}/end`,
      undefined,
      world.owner,
    );
    expect(end.statusCode).toBe(200);
    const after = await request(world, 'GET', '/team/members', tab);
    expect(after.statusCode).toBe(401);
    const body = after.json<Ended>();
    expect(body.error).toMatchObject({
      code: 'session_expired',
      reason: 'support_ended',
      supportEnded: { endedBy: 'owner', ownerName: 'مالك تجريبي' },
    });
    expect(Date.parse(body.error.supportEnded?.endedAt ?? '')).toBe(world.clock.now().getTime());
    // Stable: a reload shows the same ended page.
    expect((await request(world, 'GET', '/auth/session', tab)).json<Ended>().error.reason).toBe(
      'support_ended',
    );
  });

  it('the support session never reaches platform routes, nor the owner’s own clinic session', async () => {
    const { tab } = await supportTab(world);
    const res = await request(world, 'GET', '/platform/clinics', tab);
    expect(res.statusCode).toBe(403);
    // The super admin's own session is untouched and stays in no clinic.
    const own = await request(world, 'GET', '/auth/session', world.admin.cookie);
    expect(own.json()).toMatchObject({ tenantId: null, support: null });
  });

  it('a suspended clinic stays readable in a support session (criterion 14)', async () => {
    const { tab } = await supportTab(world);
    await patch(
      world.app,
      `/platform/clinics/${world.clinicId}`,
      { status: 'suspended' },
      world.admin.cookie,
    );
    expect((await request(world, 'GET', '/team/members', tab)).statusCode).toBe(200);
  });
});

describe('the hand-off (ADR-0050)', () => {
  it('is single-use: a second exchange answers 404 link_invalid', async () => {
    const { handoffUrl } = await opened(world);
    const token = handoffToken(handoffUrl);
    const first = await exchange(world, token);
    expect(first.statusCode).toBe(200);
    const line = String(first.headers['set-cookie']);
    expect(line).toContain(`${SUPPORT_COOKIE}=`);
    expect(line).toMatch(/HttpOnly; Secure; SameSite=Lax/);
    const second = await exchange(world, token);
    expect(second.statusCode).toBe(404);
    expect(errorCode(second)).toBe('link_invalid');
  });

  it('expires after 2 minutes, and never opens an ended grant', async () => {
    const { handoffUrl, grantId } = await opened(world);
    world.clock.advanceBy(2 * 60_000 + 1);
    expect((await exchange(world, handoffToken(handoffUrl))).statusCode).toBe(404);
    const again = await post(
      world.app,
      `/platform/support-grants/${grantId}/handoff`,
      undefined,
      world.admin.cookie,
    );
    const next = handoffToken(again.json<{ handoffUrl: string }>().handoffUrl);
    await post(world.app, `/platform/support-grants/${grantId}/end`, undefined, world.admin.cookie);
    expect((await exchange(world, next)).statusCode).toBe(404);
  });

  it('a new hand-off ends the earlier tab of the same grant (one tab)', async () => {
    const { tab, grantId } = await supportTab(world);
    const again = await post(
      world.app,
      `/platform/support-grants/${grantId}/handoff`,
      undefined,
      world.admin.cookie,
    );
    const res = await exchange(
      world,
      handoffToken(again.json<{ handoffUrl: string }>().handoffUrl),
    );
    expect(res.statusCode).toBe(200);
    // The old tab's session is gone: its cookie is ignored, and nothing else is presented.
    expect((await request(world, 'GET', '/auth/session', tab)).statusCode).toBe(401);
  });

  it('an unknown token answers 404 link_invalid', async () => {
    const res = await exchange(world, 'A'.repeat(43));
    expect(res.statusCode).toBe(404);
    expect(errorCode(res)).toBe('link_invalid');
  });
});

describe('three ways to end (criterion 12)', () => {
  it('the super admin ends it from admin web: endedBy admin', async () => {
    const { tab, grantId } = await supportTab(world);
    await post(world.app, `/platform/support-grants/${grantId}/end`, undefined, world.admin.cookie);
    const res = await request(world, 'GET', '/auth/session', tab);
    expect(res.json<Ended>().error).toMatchObject({
      reason: 'support_ended',
      supportEnded: { endedBy: 'admin', ownerName: null },
    });
  });

  it('the support tab ends its own grant: 204, then 401 support_ended', async () => {
    const { tab, grantId } = await supportTab(world);
    const end = await request(world, 'POST', '/auth/support/end', tab);
    expect(end.statusCode).toBe(204);
    expect((await grantRow(grantId))?.endReason).toBe('admin');
    const again = await request(world, 'POST', '/auth/support/end', tab);
    expect(again.statusCode).toBe(401);
    expect(again.json<Ended>().error.supportEnded?.endedBy).toBe('admin');
  });

  it('at its expiry: endedBy expiry at the grant’s end, closed once with support.expired', async () => {
    const { tab, grantId } = await supportTab(world, 30);
    await ageGrant(grantId, 31 * 60_000);
    const res = await request(world, 'GET', '/team/members', tab);
    expect(res.statusCode).toBe(401);
    const ended = res.json<Ended>().error.supportEnded;
    expect(ended?.endedBy).toBe('expiry');
    const row = await grantRow(grantId);
    expect(row?.endReason).toBe('expiry');
    expect(Date.parse(ended?.endedAt ?? '')).toBe(row?.expiresAt.getTime());
    await request(world, 'GET', '/team/members', tab);
    const expired = (await supportAuditRows()).filter((r) => r.event === 'support.expired');
    expect(expired).toHaveLength(1);
  });

  it('ending from the tab is refused to every other session (403)', async () => {
    expect((await request(world, 'POST', '/auth/support/end', world.admin.cookie)).statusCode).toBe(
      403,
    );
    expect((await request(world, 'POST', '/auth/support/end', world.owner)).statusCode).toBe(403);
  });
});

describe('audit of every request (criterion 14)', () => {
  it('one support.request row per request: method, route template, target id; no body or query', async () => {
    const { tab, grantId } = await supportTab(world);
    const member = '00000000-0000-4000-8000-0000000000ee';
    await request(world, 'GET', `/team/members/${member}?q=سر`, tab);
    await request(world, 'PATCH', '/clinic/settings', tab, { idleMinutes: 60 });
    const rows = (await supportAuditRows()).filter((r) => r.event === 'support.request');
    expect(rows.map((r) => r.data)).toEqual([
      { grantId, method: 'GET', route: '/team/members/:id' },
      { grantId, method: 'PATCH', route: '/clinic/settings' },
    ]);
    expect(rows[0]).toMatchObject({
      tenantId: world.clinicId,
      actorId: world.admin.userId,
      targetId: member,
    });
    expect(rows[1]?.targetId).toBeNull();
    expect(JSON.stringify(rows)).not.toContain('سر');
    expect(JSON.stringify(rows)).not.toContain('idleMinutes');
  });

  it('logs carry the grant id, never the reason', async () => {
    const { tab, grantId } = await supportTab(world);
    await request(world, 'POST', '/branches', tab, { name: 'فرع الدعم' });
    const text = world.app.logs.text();
    expect(text).toContain(grantId);
    expect(text).not.toContain(REASON);
  });
});
