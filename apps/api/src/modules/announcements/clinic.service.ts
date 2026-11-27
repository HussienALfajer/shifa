// A member's announcement banner (A-02 criterion 16; contract rows `A02cAnnouncements` and
// `dismissed`). The clinic's own transaction reads the announcements aimed at it (policy) and the
// person's own dismissals; which are active is decided by the API's clock. A dismissal holds for
// the version the person hid, on every device and in every clinic. A support session reads the
// banner; its dismissal is a write, refused by the guard (403 `support_read_only`).
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MyAnnouncement, MyAnnouncements } from '@shifa/contracts';
import { announcement, announcementDismissal, type Tx } from '@shifa/db';
import { eq, sql } from 'drizzle-orm';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { statusOf } from './admin.service.ts';

const LEVEL_ORDER = { warning: 0, info: 1 } as const;

@Injectable()
export class ClinicAnnouncements {
  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  mine(scope: RequestScope): Promise<MyAnnouncements> {
    return this.tenants.run(scope, async (tx) => ({
      announcements: await this.#shown(tx, scope.userId),
    }));
  }

  dismiss(scope: RequestScope, rawId: string, version: number): Promise<void> {
    const id = rawId.toLowerCase();
    return this.tenants.run(scope, async (tx) => {
      const [row] = await tx
        .select({
          id: announcement.id,
          version: announcement.version,
          startsAt: announcement.startsAt,
          endsAt: announcement.endsAt,
        })
        .from(announcement)
        .where(eq(announcement.id, id));
      // Not aimed at this clinic, not active, or a version it never had: nothing to hide.
      if (!row || statusOf(row, this.clock.now()) !== 'active' || version > row.version) {
        throw new NotFoundException();
      }
      const now = this.clock.now();
      await tx
        .insert(announcementDismissal)
        .values({
          userId: scope.userId,
          announcementId: id,
          version,
          dismissedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [announcementDismissal.userId, announcementDismissal.announcementId],
          set: {
            version: sql`greatest(${announcementDismissal.version}, excluded.version)`,
            dismissedAt: now,
            updatedAt: now,
          },
        });
    });
  }

  /** Active, aimed at the clinic, not hidden by the person: warnings first, then newest. */
  async #shown(tx: Tx, userId: string): Promise<MyAnnouncement[]> {
    const now = this.clock.now();
    const rows = await tx
      .select({
        id: announcement.id,
        version: announcement.version,
        level: announcement.level,
        body: announcement.body,
        startsAt: announcement.startsAt,
        endsAt: announcement.endsAt,
      })
      .from(announcement);
    const hidden = await tx
      .select({ id: announcementDismissal.announcementId, version: announcementDismissal.version })
      .from(announcementDismissal)
      .where(eq(announcementDismissal.userId, userId));
    const hiddenVersion = new Map(hidden.map((h) => [h.id, h.version]));
    return rows
      .filter((r) => statusOf(r, now) === 'active' && (hiddenVersion.get(r.id) ?? 0) < r.version)
      .sort(
        (a, b) =>
          LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
          b.startsAt.getTime() - a.startsAt.getTime() ||
          (a.id < b.id ? -1 : 1),
      )
      .map((r) => ({
        id: r.id,
        version: r.version,
        level: r.level,
        body: r.body,
        startsAt: r.startsAt.toISOString(),
        endsAt: r.endsAt?.toISOString() ?? null,
      }));
  }
}
