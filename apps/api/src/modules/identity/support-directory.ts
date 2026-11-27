// What the support module needs from the auth path (A-02-05): the super admin's name for a new
// grant (shifa_platform reads no account), and the clinic of one of the super admin's own grants
// (the platform reads grants only inside their clinic; routes by grant id carry no clinic).
import { Inject, Injectable } from '@nestjs/common';
import { type AuthDb, supportAccessGrant, user } from '@shifa/db';
import { and, eq } from 'drizzle-orm';
import { AUTH_DB } from './tokens.ts';

@Injectable()
export class SupportDirectory {
  constructor(@Inject(AUTH_DB) private readonly authDb: AuthDb) {}

  /** The person's display name, or null when there is no such account. */
  async nameOf(userId: string): Promise<string | null> {
    const [row] = await this.authDb.withAuth((tx) =>
      tx.select({ name: user.name }).from(user).where(eq(user.id, userId)),
    );
    return row?.name ?? null;
  }

  /** The clinic of `grantId` when it is this super admin's own grant; otherwise null. */
  async clinicOfOwnGrant(adminUserId: string, grantId: string): Promise<string | null> {
    const [row] = await this.authDb.withUser(adminUserId, (tx) =>
      tx
        .select({ tenantId: supportAccessGrant.tenantId })
        .from(supportAccessGrant)
        .where(
          and(eq(supportAccessGrant.id, grantId), eq(supportAccessGrant.adminUserId, adminUserId)),
        ),
    );
    return row?.tenantId ?? null;
  }
}
