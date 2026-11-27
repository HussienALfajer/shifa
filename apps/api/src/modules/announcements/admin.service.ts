// The super admin's announcements (A-02 criteria 16, 18, 22; contract rows of `A02Announcements`):
// listed by status with counts, created, edited (a new body or level is a new version) and ended
// early or cancelled; never deleted. Each call is one withPlatformAdmin() transaction with its
// audit row: ids, level, target and the number of clinics, never the body. Dismissals and targeted
// members come from announcement_counts() (integers only, ADR-0051).
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type Announcement,
  type AnnouncementList,
  type AnnouncementStatus,
  type CreateAnnouncementRequest,
  hasAnnouncementLink,
  type UpdateAnnouncementRequest,
} from '@shifa/contracts';
import {
  announcement,
  announcementCounts,
  announcementTarget,
  type PlatformDb,
  type PlatformEvent,
  type PlatformTx,
  tenant,
} from '@shifa/db';
import { desc, eq, inArray } from 'drizzle-orm';
import type { Principal } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { SupportDirectory } from '../identity/index.ts';
import { ANNOUNCEMENTS_PLATFORM_DB } from './tokens.ts';

type Row = typeof announcement.$inferSelect;

/** By the time of the read: before its start, from its end, or between. */
export function statusOf(row: Pick<Row, 'startsAt' | 'endsAt'>, now: Date): AnnouncementStatus {
  if (row.endsAt !== null && row.endsAt.getTime() <= now.getTime()) return 'ended';
  if (row.startsAt.getTime() > now.getTime()) return 'scheduled';
  return 'active';
}

const ended = () => new ApiError(409, 'announcement_ended');
const invalid = (path: 'body.endsAt' | 'body.clinicIds', code: 'custom' | 'invalid_value') =>
  new RequestValidationError([{ path, code }]);

interface Fields {
  body: string;
  level: Row['level'];
  startsAt: Date;
  endsAt: Date | null;
  target: Row['target'];
  clinicIds: string[];
}

@Injectable()
export class AnnouncementsAdmin {
  constructor(
    @Inject(ANNOUNCEMENTS_PLATFORM_DB) private readonly platformDb: PlatformDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SupportDirectory) private readonly directory: SupportDirectory,
  ) {}

  list(
    principal: Principal,
    status: AnnouncementStatus | undefined,
    requestId: string,
  ): Promise<AnnouncementList> {
    return this.#run(principal, 'announcement.listed', requestId, async (tx) => {
      const now = this.clock.now();
      const rows = await tx
        .select()
        .from(announcement)
        .orderBy(desc(announcement.createdAt), desc(announcement.id));
      const counts = { scheduled: 0, active: 0, ended: 0 };
      for (const row of rows) counts[statusOf(row, now)] += 1;
      const shown = status ? rows.filter((r) => statusOf(r, now) === status) : rows;
      return { counts, announcements: await views(tx, shown, now) };
    });
  }

  async create(
    principal: Principal,
    input: CreateAnnouncementRequest,
    requestId: string,
  ): Promise<Announcement> {
    const fields: Fields = {
      body: input.body,
      level: input.level,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      target: input.target,
      clinicIds: unique(input.clinicIds ?? []),
    };
    if (hasAnnouncementLink(fields.body)) throw new ApiError(400, 'announcement_link');
    if (fields.target === 'all' && fields.clinicIds.length > 0)
      throw invalid('body.clinicIds', 'custom');
    const name = await this.directory.nameOf(principal.userId);
    return this.#run(principal, 'announcement.created', requestId, async (tx, audit) => {
      const now = this.clock.now();
      checkPeriod(fields, now);
      await checkClinics(tx, fields);
      const [row] = await tx
        .insert(announcement)
        .values({
          body: fields.body,
          level: fields.level,
          startsAt: fields.startsAt,
          endsAt: fields.endsAt,
          target: fields.target,
          createdBy: principal.userId,
          createdByName: name,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new Error('announcement not written');
      await writeTargets(tx, row.id, fields);
      audit(row.id, fields);
      return one(await views(tx, [row], now));
    });
  }

  update(
    principal: Principal,
    rawId: string,
    input: UpdateAnnouncementRequest,
    requestId: string,
  ): Promise<Announcement> {
    const id = rawId.toLowerCase();
    if (input.body !== undefined && hasAnnouncementLink(input.body)) {
      return Promise.reject(new ApiError(400, 'announcement_link'));
    }
    return this.#run(principal, 'announcement.edited', requestId, async (tx, audit) => {
      const now = this.clock.now();
      const row = await locked(tx, id);
      if (statusOf(row, now) === 'ended') throw ended();
      const current = await targetsOf(tx, [row.id]);
      const target = input.target ?? row.target;
      const fields: Fields = {
        body: input.body ?? row.body,
        level: input.level ?? row.level,
        startsAt: input.startsAt ? new Date(input.startsAt) : row.startsAt,
        endsAt:
          input.endsAt === undefined
            ? row.endsAt
            : input.endsAt === null
              ? null
              : new Date(input.endsAt),
        target,
        clinicIds:
          target === 'all'
            ? []
            : unique(
                input.clinicIds ?? current.filter((t) => t.id === row.id).map((t) => t.tenantId),
              ),
      };
      if (target === 'all' && (input.clinicIds?.length ?? 0) > 0) {
        throw invalid('body.clinicIds', 'custom');
      }
      checkPeriod(fields, now);
      await checkClinics(tx, fields);
      const newVersion = fields.body !== row.body || fields.level !== row.level;
      const [changed] = await tx
        .update(announcement)
        .set({
          body: fields.body,
          level: fields.level,
          startsAt: fields.startsAt,
          endsAt: fields.endsAt,
          target: fields.target,
          version: newVersion ? row.version + 1 : row.version,
          updatedAt: now,
        })
        .where(eq(announcement.id, row.id))
        .returning();
      if (!changed) throw new NotFoundException();
      await tx.delete(announcementTarget).where(eq(announcementTarget.announcementId, row.id));
      await writeTargets(tx, row.id, fields);
      audit(row.id, fields);
      return one(await views(tx, [changed], now));
    });
  }

  async end(principal: Principal, rawId: string, requestId: string): Promise<Announcement> {
    const id = rawId.toLowerCase();
    const name = await this.directory.nameOf(principal.userId);
    return this.#run(principal, 'announcement.ended', requestId, async (tx, audit) => {
      const now = this.clock.now();
      const row = await locked(tx, id);
      if (statusOf(row, now) === 'ended') throw ended();
      const [changed] = await tx
        .update(announcement)
        .set({
          endsAt: now,
          endedEarly: true,
          endedBy: principal.userId,
          endedByName: name,
          updatedAt: now,
        })
        .where(eq(announcement.id, row.id))
        .returning();
      if (!changed) throw new NotFoundException();
      const targets = await targetsOf(tx, [row.id]);
      audit(row.id, {
        level: row.level,
        target: row.target,
        clinicIds: targets.map((t) => t.tenantId),
      });
      return one(await views(tx, [changed], now));
    });
  }

  #run<T>(
    principal: Principal,
    event: PlatformEvent,
    requestId: string,
    fn: (
      tx: PlatformTx,
      audit: (id: string, f: Pick<Fields, 'level' | 'target' | 'clinicIds'>) => void,
    ) => Promise<T>,
  ): Promise<T> {
    return this.platformDb.withPlatformAdmin(
      { actorId: principal.userId, event, requestId },
      (tx, audit) =>
        fn(tx, (id, f) => {
          audit.setTarget(id);
          audit.setData({
            level: f.level,
            target: f.target,
            clinics: String(f.clinicIds.length),
          });
        }),
    );
  }
}

const unique = (ids: readonly string[]) => [...new Set(ids.map((i) => i.toLowerCase()))];

function one(list: readonly Announcement[]): Announcement {
  const [view] = list;
  if (!view) throw new Error('announcement view missing');
  return view;
}

/** An end after the start and not past (400 body.endsAt). */
function checkPeriod(fields: Fields, now: Date): void {
  const { startsAt, endsAt } = fields;
  if (endsAt !== null && (endsAt <= startsAt || endsAt <= now)) {
    throw invalid('body.endsAt', 'custom');
  }
}

/** A selected target names existing clinics, at least one (400 body.clinicIds). */
async function checkClinics(tx: PlatformTx, fields: Fields): Promise<void> {
  if (fields.target === 'all') return;
  if (fields.clinicIds.length === 0) throw invalid('body.clinicIds', 'custom');
  const found = await tx
    .select({ id: tenant.id })
    .from(tenant)
    .where(inArray(tenant.id, fields.clinicIds));
  if (found.length !== fields.clinicIds.length) throw invalid('body.clinicIds', 'invalid_value');
}

async function writeTargets(tx: PlatformTx, id: string, fields: Fields): Promise<void> {
  if (fields.target !== 'selected' || fields.clinicIds.length === 0) return;
  await tx
    .insert(announcementTarget)
    .values(fields.clinicIds.map((tenantId) => ({ tenantId, announcementId: id })));
}

async function locked(tx: PlatformTx, id: string): Promise<Row> {
  const [row] = await tx.select().from(announcement).where(eq(announcement.id, id)).for('update');
  if (!row) throw new NotFoundException();
  return row;
}

function targetsOf(tx: PlatformTx, ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return tx
    .select({ id: announcementTarget.announcementId, tenantId: announcementTarget.tenantId })
    .from(announcementTarget)
    .where(inArray(announcementTarget.announcementId, [...ids]));
}

/** The rows as the list shows them: clinics by name, and the counts of the started ones. */
async function views(tx: PlatformTx, rows: readonly Row[], now: Date): Promise<Announcement[]> {
  if (rows.length === 0) return [];
  const targets = await targetsOf(
    tx,
    rows.map((r) => r.id),
  );
  const clinicIds = [...new Set(targets.map((t) => t.tenantId))];
  const names = new Map(
    clinicIds.length === 0
      ? []
      : (
          await tx
            .select({ id: tenant.id, name: tenant.name })
            .from(tenant)
            .where(inArray(tenant.id, clinicIds))
        ).map((c) => [c.id, c.name]),
  );
  const started = rows.filter((r) => statusOf(r, now) !== 'scheduled');
  const counts = await announcementCounts(
    tx,
    started.map((r) => ({ id: r.id, version: r.version, all: r.target === 'all' })),
  );
  return rows.map((r) => {
    const figures = counts.get(r.id);
    return {
      id: r.id,
      version: r.version,
      body: r.body,
      level: r.level,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt?.toISOString() ?? null,
      status: statusOf(r, now),
      endedEarly: r.endedEarly,
      endedByName: r.endedByName,
      target: r.target,
      clinics: targets
        .filter((t) => t.id === r.id)
        .map((t) => ({ id: t.tenantId, name: names.get(t.tenantId) ?? '' }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1)),
      createdByName: r.createdByName,
      createdAt: r.createdAt.toISOString(),
      dismissedCount: figures?.dismissed ?? null,
      targetedMembers: figures?.targeted ?? null,
    };
  });
}
