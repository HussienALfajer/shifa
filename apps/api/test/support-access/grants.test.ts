// A-02-05: the super admin's grants and the owner's side (criteria 11, 13, 14, 26; contract rows
// `sup`, `supOpen`, «فتح عيادة الويب», `supEnded`, `supSuspended`, `banner`, `endAsk`, `ended`,
// `logEmpty`). Reason 10–500 after trimming and 30/60/120/240 minutes only; one open grant per
// super admin per clinic (409 `support_active`); a suspended clinic opens; a new hand-off while
// open, 409 `support_ended` after; the owner sees the open grant and the log, ends it, and another
// clinic's owner sees nothing; audit rows per event, never the reason.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { errorCode, patch, post } from '../platform/support.ts';
import {
  ageGrant,
  anotherClinic,
  grantRow,
  handoffToken,
  opened,
  openGrant,
  REASON,
  request,
  supportAuditRows,
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

const list = (clinicId = world.clinicId) =>
  request(world, 'GET', `/platform/clinics/${clinicId}/support-grants`, world.admin.cookie);

describe('opening a grant (criterion 11)', () => {
  it('answers the grant and a single-use hand-off URL on clinic web', async () => {
    const res = await openGrant(world, { reason: `  ${REASON}  `, minutes: 120 });
    expect(res.statusCode).toBe(201);
    const body = res.json<{
      grant: Record<string, unknown>;
      handoffUrl: string;
    }>();
    expect(body.handoffUrl).toMatch(
      /^https:\/\/clinic\.shifa\.invalid\/support#[A-Za-z0-9_-]{43}$/,
    );
    expect(body.grant).toMatchObject({
      adminName: 'مشرف تجريبي',
      reason: REASON,
      endedAt: null,
      endedBy: null,
      endedByName: null,
    });
    const startedAt = Date.parse(String(body.grant['startedAt']));
    expect(Date.parse(String(body.grant['expiresAt'])) - startedAt).toBe(120 * 60_000);
    const row = await grantRow(String(body.grant['id']));
    // Only the token's SHA-256 is stored, never the token.
    expect(row?.handoffTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.handoffTokenHash).not.toContain(handoffToken(body.handoffUrl));
  });

  it('refuses a reason outside 10–500 characters after trimming, and other durations', async () => {
    for (const body of [
      { reason: '   قصير    ', minutes: 60 },
      { reason: 'س'.repeat(501), minutes: 60 },
      { reason: REASON, minutes: 45 },
      { reason: REASON, minutes: 480 },
      { reason: REASON },
    ]) {
      const res = await openGrant(world, body);
      expect(res.statusCode, JSON.stringify(body).slice(0, 40)).toBe(400);
      expect(errorCode(res)).toBe('validation_failed');
    }
    for (const minutes of [30, 60, 120, 240]) {
      const res = await openGrant(world, { reason: REASON, minutes });
      expect(res.statusCode).toBe(201);
      const id = res.json<{ grant: { id: string } }>().grant.id;
      await post(world.app, `/platform/support-grants/${id}/end`, undefined, world.admin.cookie);
    }
  });

  it('one open grant per super admin per clinic: 409 support_active', async () => {
    await opened(world);
    const second = await openGrant(world);
    expect(second.statusCode).toBe(409);
    expect(errorCode(second)).toBe('support_active');
    // Another clinic is another grant.
    const other = await anotherClinic(world);
    expect((await openGrant(world, undefined, other.clinicId)).statusCode).toBe(201);
  });

  it('an expired grant is closed and a new one opens (one support.expired row)', async () => {
    const { grantId } = await opened(world, 30);
    await ageGrant(grantId, 31 * 60_000);
    expect((await openGrant(world)).statusCode).toBe(201);
    const row = await grantRow(grantId);
    expect(row?.endReason).toBe('expiry');
    expect(row?.endedAt?.getTime()).toBe(row?.expiresAt.getTime());
    const expired = (await supportAuditRows()).filter((r) => r.event === 'support.expired');
    expect(expired).toHaveLength(1);
    expect(expired[0]).toMatchObject({ targetId: grantId, data: { endedBy: 'expiry' } });
  });

  it('a suspended clinic can still be opened (criterion 14)', async () => {
    const res = await patch(
      world.app,
      `/platform/clinics/${world.clinicId}`,
      { status: 'suspended' },
      world.admin.cookie,
    );
    expect(res.statusCode).toBe(200);
    expect((await openGrant(world)).statusCode).toBe(201);
  });

  it('an unknown clinic answers 404', async () => {
    const res = await openGrant(world, undefined, '00000000-0000-4000-8000-0000000000ff');
    expect(res.statusCode).toBe(404);
  });
});

describe('the super admin’s view, hand-off again and end', () => {
  it('lists `now`, this admin’s open grant (`mine`) and every grant', async () => {
    const empty = await list();
    expect(empty.json()).toMatchObject({ mine: null, grants: [] });
    const { grantId } = await opened(world);
    const res = await list();
    expect(res.statusCode).toBe(200);
    const body = res.json<{ now: string; mine: { id: string } | null; grants: unknown[] }>();
    expect(Date.parse(body.now)).toBe(world.clock.now().getTime());
    expect(body.mine?.id).toBe(grantId);
    expect(body.grants).toHaveLength(1);
  });

  it('issues a new single-use hand-off while open, 409 support_ended after the end', async () => {
    const { grantId, handoffUrl } = await opened(world);
    const again = await post(
      world.app,
      `/platform/support-grants/${grantId}/handoff`,
      undefined,
      world.admin.cookie,
    );
    expect(again.statusCode).toBe(200);
    const next = again.json<{ handoffUrl: string }>().handoffUrl;
    expect(handoffToken(next)).not.toBe(handoffToken(handoffUrl));

    const end = await post(
      world.app,
      `/platform/support-grants/${grantId}/end`,
      undefined,
      world.admin.cookie,
    );
    expect(end.statusCode).toBe(200);
    expect(end.json()).toMatchObject({ endedBy: 'admin', endedByName: 'مشرف تجريبي' });
    for (const path of ['handoff', 'end']) {
      const res = await post(
        world.app,
        `/platform/support-grants/${grantId}/${path}`,
        undefined,
        world.admin.cookie,
      );
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('support_ended');
    }
    const log = (await list()).json<{ mine: unknown; grants: { endedBy: string }[] }>();
    expect(log.mine).toBeNull();
    expect(log.grants[0]?.endedBy).toBe('admin');
  });

  it('another super admin’s or an unknown grant answers 404', async () => {
    const res = await post(
      world.app,
      '/platform/support-grants/00000000-0000-4000-8000-0000000000ff/end',
      undefined,
      world.admin.cookie,
    );
    expect(res.statusCode).toBe(404);
  });
});

describe('the owner’s banner, log and end (criteria 13, 26)', () => {
  const ownerList = (cookie = world.owner) =>
    request(world, 'GET', '/clinic/support-grants', cookie);

  it('shows the open grant with the server time, and an empty log before', async () => {
    expect((await ownerList()).json()).toMatchObject({ open: [], grants: [] });
    const { grantId } = await opened(world);
    const res = await ownerList();
    expect(res.statusCode).toBe(200);
    const body = res.json<{ now: string; open: Record<string, unknown>[]; grants: unknown[] }>();
    expect(Date.parse(body.now)).toBe(world.clock.now().getTime());
    expect(body.open).toEqual([
      {
        id: grantId,
        adminName: 'مشرف تجريبي',
        reason: REASON,
        expiresAt: expect.any(String),
      },
    ]);
    expect(body.grants).toHaveLength(1);
  });

  it('the owner ends it: the banner goes, the log says by whom', async () => {
    const { grantId } = await opened(world);
    const end = await post(
      world.app,
      `/clinic/support-grants/${grantId}/end`,
      undefined,
      world.owner,
    );
    expect(end.statusCode).toBe(200);
    expect(end.json()).toMatchObject({ endedBy: 'owner', endedByName: 'مالك تجريبي' });
    const again = await post(
      world.app,
      `/clinic/support-grants/${grantId}/end`,
      undefined,
      world.owner,
    );
    expect(again.statusCode).toBe(409);
    expect(errorCode(again)).toBe('support_ended');
    const body = (await ownerList()).json<{ open: unknown[]; grants: { endedBy: string }[] }>();
    expect(body.open).toEqual([]);
    expect(body.grants[0]?.endedBy).toBe('owner');
  });

  it('an expired grant leaves the banner and reads as ended by expiry', async () => {
    const { grantId } = await opened(world, 30);
    await ageGrant(grantId, 31 * 60_000);
    const body = (await ownerList()).json<{ open: unknown[]; grants: Record<string, unknown>[] }>();
    expect(body.open).toEqual([]);
    expect(body.grants[0]).toMatchObject({ id: grantId, endedBy: 'expiry' });
  });

  it('another clinic’s owner sees nothing of it and cannot end it', async () => {
    const { grantId } = await opened(world);
    const other = await anotherClinic(world);
    const body = (await ownerList(other.owner)).json<{ open: unknown[]; grants: unknown[] }>();
    expect(body).toMatchObject({ open: [], grants: [] });
    const end = await post(
      world.app,
      `/clinic/support-grants/${grantId}/end`,
      undefined,
      other.owner,
    );
    expect(end.statusCode).toBe(404);
    expect((await grantRow(grantId))?.endedAt).toBeNull();
  });
});

describe('audit (criterion 14)', () => {
  it('opened with its duration, hand-off, ended by whom; never the reason', async () => {
    const { grantId } = await opened(world, 30);
    await post(
      world.app,
      `/platform/support-grants/${grantId}/handoff`,
      undefined,
      world.admin.cookie,
    );
    await post(world.app, `/clinic/support-grants/${grantId}/end`, undefined, world.owner);
    const rows = await supportAuditRows();
    const events = rows.map((r) => r.event);
    expect(events).toEqual(
      expect.arrayContaining(['support.opened', 'support.handoff_issued', 'support.ended']),
    );
    const open = rows.find((r) => r.event === 'support.opened');
    expect(open).toMatchObject({
      tenantId: null,
      actorId: world.admin.userId,
      targetId: world.clinicId,
      data: { minutes: '30', grantId },
    });
    const ended = rows.find((r) => r.event === 'support.ended');
    expect(ended).toMatchObject({ tenantId: world.clinicId, targetId: grantId });
    expect(ended?.data).toEqual({ endedBy: 'owner' });
    expect(JSON.stringify(rows)).not.toContain(REASON);
    expect(world.app.logs.text()).not.toContain(REASON);
  });
});
