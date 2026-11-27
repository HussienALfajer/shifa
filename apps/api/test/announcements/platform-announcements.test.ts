// A-02 criteria 16, 18 and 22 (A-02-07; contract rows of `A02Announcements`: list, create, edit,
// end early or cancel). The super admin posts plain-text announcements (1–280 characters after
// trimming, no link, e-mail or markup: 400 `announcement_link`) to every clinic or to selected
// ones, edits them (body or level: a new version), ends them early or cancels a scheduled one
// (ending it before its start); an ended one answers 409 `announcement_ended`. The list counts
// each status and shows, for active and ended ones, how many targeted members dismissed it
// (integers only). One platform audit row per change: ids, level and target count, never the body.
import {
  Announcement,
  AnnouncementList,
  ErrorEnvelope,
  hasAnnouncementLink,
} from '@shifa/contracts';
import { auditEvent } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import {
  activeMember,
  type Clinic,
  errorCode,
  get,
  patch,
  post,
  type TeamWorld,
  teamWorld,
} from '../team/support.ts';

const clock = testClock();
const HOUR = 3_600_000;
let world: TeamWorld;
let first: Clinic;
let second: Clinic;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_07);
  first = await world.clinic();
  second = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

const admin = () => world.admin.cookie;
const iso = (offsetMs: number) => new Date(clock.now().getTime() + offsetMs).toISOString();
const issues = (res: { json(): unknown }) => ErrorEnvelope.parse(res.json()).error.details ?? [];

async function create(body: Record<string, unknown>): Promise<Announcement> {
  const res = await post(world.app, '/platform/announcements', body, admin());
  expect(res.statusCode, res.body).toBe(201);
  return Announcement.parse(res.json());
}
async function list(status?: string) {
  const res = await get(
    world.app,
    `/platform/announcements${status ? `?status=${status}` : ''}`,
    admin(),
  );
  expect(res.statusCode, res.body).toBe(200);
  return AnnouncementList.parse(res.json());
}
const announcementAudit = () =>
  superuserDb(workerDatabaseName())
    .select()
    .from(auditEvent)
    .where(
      inArray(auditEvent.event, [
        'announcement.created',
        'announcement.edited',
        'announcement.ended',
      ]),
    )
    .orderBy(auditEvent.at);

const BODY = 'صيانة الليلة من الساعة 11 حتى 12';

describe('the body rules (row `form`, `linkError`; criterion 16)', () => {
  it('finds links, domains, e-mails and markup, and leaves plain Arabic text and numbers', () => {
    for (const body of [
      'زوروا https://example.com',
      'زوروا http://x.y',
      'زوروا www.example',
      'الموقع example.com للتفاصيل',
      'راسلونا على t.me/shifa',
      'البريد a.b@example.org',
      'نص <b>عريض</b>',
      '<script>alert(1)</script>',
      'رابط <a href="x">هنا</a>',
    ]) {
      expect(hasAnnouncementLink(body), body).toBe(true);
    }
    for (const body of [
      BODY,
      'الدوام من 9.30 حتى 2.15',
      'خصم 10% على الاستشارات، يوم 12/5',
      'الطبيب د. أحمد متاح غدًا',
      'العدد أقل من 5 أو أكثر من 3',
    ]) {
      expect(hasAnnouncementLink(body), body).toBe(false);
    }
  });

  it('refuses an empty or over-long body (400 validation_failed body.body)', async () => {
    for (const body of ['', '    ', 'م'.repeat(281)]) {
      const res = await post(
        world.app,
        '/platform/announcements',
        { body, level: 'info', startsAt: iso(0), target: 'all' },
        admin(),
      );
      expect(res.statusCode, body).toBe(400);
      expect(errorCode(res)).toBe('validation_failed');
      expect(issues(res).map((i) => i.path)).toEqual(['body.body']);
    }
  });

  it('accepts 280 characters after trimming', async () => {
    const created = await create({
      body: `  ${'م'.repeat(280)}  `,
      level: 'info',
      startsAt: iso(-HOUR),
      endsAt: iso(-HOUR + 60_000 + HOUR),
      target: 'all',
    });
    expect(created.body).toBe('م'.repeat(280));
    const ended = await post(
      world.app,
      `/platform/announcements/${created.id}/end`,
      undefined,
      admin(),
    );
    expect(ended.statusCode, ended.body).toBe(200);
  });

  it('refuses a link, an e-mail or markup (400 announcement_link) and writes nothing', async () => {
    const before = (await list()).announcements.length;
    for (const body of ['زوروا www.shifa-clinic.example', 'راسلونا a@b.co', 'نص <i>مائل</i>']) {
      const res = await post(
        world.app,
        '/platform/announcements',
        { body, level: 'warning', startsAt: iso(0), target: 'all' },
        admin(),
      );
      expect(res.statusCode, body).toBe(400);
      expect(errorCode(res)).toBe('announcement_link');
    }
    expect((await list()).announcements.length).toBe(before);
  });

  it('refuses an end not after the start or already past (body.endsAt)', async () => {
    for (const [startsAt, endsAt] of [
      [iso(HOUR), iso(HOUR)],
      [iso(2 * HOUR), iso(HOUR)],
      [iso(-2 * HOUR), iso(-HOUR)],
    ]) {
      const res = await post(
        world.app,
        '/platform/announcements',
        { body: BODY, level: 'info', startsAt, endsAt, target: 'all' },
        admin(),
      );
      expect(res.statusCode).toBe(400);
      expect(issues(res).map((i) => i.path)).toEqual(['body.endsAt']);
    }
  });

  it('refuses a selected target without clinics, or with an unknown one (body.clinicIds)', async () => {
    for (const clinicIds of [undefined, [], ['00000000-0000-4000-8000-00000000dead']]) {
      const res = await post(
        world.app,
        '/platform/announcements',
        {
          body: BODY,
          level: 'info',
          startsAt: iso(0),
          target: 'selected',
          ...(clinicIds ? { clinicIds } : {}),
        },
        admin(),
      );
      expect(res.statusCode, JSON.stringify(clinicIds)).toBe(400);
      expect(issues(res).map((i) => i.path)).toEqual(['body.clinicIds']);
    }
  });
});

let everyone: Announcement;
let selected: Announcement;
let later: Announcement;

describe('create and list (rows `list`, `created`, `scheduled`; criterion 16)', () => {
  it('creates an active announcement for every clinic', async () => {
    everyone = await create({
      body: BODY,
      level: 'warning',
      startsAt: iso(-60_000),
      target: 'all',
    });
    expect(everyone).toMatchObject({
      version: 1,
      body: BODY,
      level: 'warning',
      endsAt: null,
      status: 'active',
      endedEarly: false,
      endedByName: null,
      target: 'all',
      clinics: [],
      createdByName: 'مشرف تجريبي',
    });
  });

  it('creates one for selected clinics, named in the answer', async () => {
    selected = await create({
      body: 'تحديث للنظام في عيادتكم',
      level: 'info',
      startsAt: iso(-60_000),
      endsAt: iso(5 * HOUR),
      target: 'selected',
      clinicIds: [first.clinicId],
    });
    expect(selected.target).toBe('selected');
    expect(selected.clinics.map((c) => c.id)).toEqual([first.clinicId]);
    expect(selected.clinics[0]?.name).toBeTruthy();
  });

  it('creates a scheduled one (start in the future), with no dismissal figures', async () => {
    later = await create({
      body: 'إعلان قادم',
      level: 'info',
      startsAt: iso(24 * HOUR),
      target: 'all',
    });
    expect(later.status).toBe('scheduled');
    expect(later.dismissedCount).toBeNull();
    expect(later.targetedMembers).toBeNull();
  });

  it('counts each status and filters by `status`', async () => {
    const all = await list();
    expect(all.counts).toEqual({ scheduled: 1, active: 2, ended: 1 });
    expect((await list('scheduled')).announcements.map((a) => a.id)).toEqual([later.id]);
    expect((await list('active')).announcements.map((a) => a.id).sort()).toEqual(
      [everyone.id, selected.id].sort(),
    );
    expect((await list('ended')).announcements).toHaveLength(1);
  });
});

describe('targeted members and dismissals (criterion 22)', () => {
  it('counts the non-deactivated members of the targeted clinics, and their dismissals', async () => {
    const doctor = await activeMember(world, first, [{ role: 'doctor', branchId: null }]);
    let rows = (await list('active')).announcements;
    // first: owner + doctor; second: owner.
    expect(rows.find((a) => a.id === everyone.id)).toMatchObject({
      targetedMembers: 3,
      dismissedCount: 0,
    });
    expect(rows.find((a) => a.id === selected.id)).toMatchObject({
      targetedMembers: 2,
      dismissedCount: 0,
    });

    const dismissed = await post(
      world.app,
      `/me/announcements/${everyone.id}/dismiss`,
      { version: 1 },
      doctor.cookie,
    );
    expect(dismissed.statusCode, dismissed.body).toBe(204);
    rows = (await list('active')).announcements;
    expect(rows.find((a) => a.id === everyone.id)?.dismissedCount).toBe(1);
    expect(rows.find((a) => a.id === selected.id)?.dismissedCount).toBe(0);

    // A deactivated member is no longer targeted, nor counted as having dismissed.
    const off = await post(
      world.app,
      `/team/members/${doctor.membershipId}/deactivate`,
      undefined,
      first.owner.cookie,
    );
    expect(off.statusCode, off.body).toBe(200);
    rows = (await list('active')).announcements;
    expect(rows.find((a) => a.id === everyone.id)).toMatchObject({
      targetedMembers: 2,
      dismissedCount: 0,
    });
  });
});

describe('edit (row `edit`; criterion 16)', () => {
  it('a new body or level is a new version; other fields keep it', async () => {
    const res = await patch(
      world.app,
      `/platform/announcements/${selected.id}`,
      { body: 'تحديث للنظام الليلة' },
      admin(),
    );
    expect(res.statusCode, res.body).toBe(200);
    const edited = Announcement.parse(res.json());
    expect(edited).toMatchObject({ version: 2, body: 'تحديث للنظام الليلة', level: 'info' });
    const moved = await patch(
      world.app,
      `/platform/announcements/${selected.id}`,
      { endsAt: iso(6 * HOUR), target: 'selected', clinicIds: [first.clinicId, second.clinicId] },
      admin(),
    );
    expect(moved.statusCode, moved.body).toBe(200);
    const after = Announcement.parse(moved.json());
    expect(after.version).toBe(2);
    expect(after.clinics.map((c) => c.id).sort()).toEqual([first.clinicId, second.clinicId].sort());
  });

  it('applies the create rules to an edit', async () => {
    const link = await patch(
      world.app,
      `/platform/announcements/${selected.id}`,
      { body: 'انظر example.com' },
      admin(),
    );
    expect(errorCode(link)).toBe('announcement_link');
    const end = await patch(
      world.app,
      `/platform/announcements/${selected.id}`,
      { endsAt: iso(-HOUR) },
      admin(),
    );
    expect(issues(end).map((i) => i.path)).toEqual(['body.endsAt']);
  });

  it('answers 404 for an unknown announcement', async () => {
    const res = await patch(
      world.app,
      '/platform/announcements/00000000-0000-4000-8000-00000000beef',
      { level: 'warning' },
      admin(),
    );
    expect(res.statusCode).toBe(404);
  });
});

describe('end early and cancel (row `endAsk`; criterion 16)', () => {
  it('ends an active one early, named by who ended it', async () => {
    const res = await post(
      world.app,
      `/platform/announcements/${selected.id}/end`,
      undefined,
      admin(),
    );
    expect(res.statusCode, res.body).toBe(200);
    const ended = Announcement.parse(res.json());
    expect(ended).toMatchObject({ status: 'ended', endedEarly: true, endedByName: 'مشرف تجريبي' });
    expect(Date.parse(ended.endsAt ?? '')).toBeLessThanOrEqual(clock.now().getTime());
  });

  it('cancels a scheduled one by ending it before its start', async () => {
    const res = await post(
      world.app,
      `/platform/announcements/${later.id}/end`,
      undefined,
      admin(),
    );
    expect(res.statusCode, res.body).toBe(200);
    expect(Announcement.parse(res.json()).status).toBe('ended');
    expect((await list()).counts).toEqual({ scheduled: 0, active: 1, ended: 3 });
  });

  it('answers 409 announcement_ended to an edit or end of an ended one', async () => {
    const again = await post(
      world.app,
      `/platform/announcements/${later.id}/end`,
      undefined,
      admin(),
    );
    expect(again.statusCode).toBe(409);
    expect(errorCode(again)).toBe('announcement_ended');
    const edit = await patch(
      world.app,
      `/platform/announcements/${selected.id}`,
      { level: 'warning' },
      admin(),
    );
    expect(edit.statusCode).toBe(409);
    expect(errorCode(edit)).toBe('announcement_ended');
  });

  it('keeps dismissal figures on an ended one', async () => {
    const row = (await list('ended')).announcements.find((a) => a.id === selected.id);
    expect(row?.targetedMembers).toBe(2);
    expect(row?.dismissedCount).toBe(0);
  });
});

describe('access', () => {
  it('is the super admin’s only', async () => {
    const res = await get(world.app, '/platform/announcements', first.owner.cookie);
    expect(res.statusCode).toBe(403);
  });
});

describe('audit (criterion 18)', () => {
  it('one row per change with ids, level and target count, never the body', async () => {
    const rows = await announcementAudit();
    const adminId = (await get(world.app, '/auth/session', admin())).json<{ userId: string }>()
      .userId;
    expect(rows.map((r) => r.event)).toEqual([
      'announcement.created', // 280 characters
      'announcement.ended',
      'announcement.created', // everyone
      'announcement.created', // selected
      'announcement.created', // later
      'announcement.edited',
      'announcement.edited',
      'announcement.ended',
      'announcement.ended',
    ]);
    for (const row of rows) {
      expect(row.tenantId).toBeNull();
      expect(row.actorId).toBe(adminId);
      expect(row.targetId).toMatch(/^[0-9a-f-]{36}$/);
      expect(JSON.stringify(row.data)).not.toMatch(/[؀-ۿ]/u);
    }
    expect(rows[3]?.data).toEqual({ level: 'info', target: 'selected', clinics: '1' });
    expect(rows[2]?.data).toEqual({ level: 'warning', target: 'all', clinics: '0' });
    expect(rows[6]?.data).toMatchObject({ clinics: '2' });
  });
});
