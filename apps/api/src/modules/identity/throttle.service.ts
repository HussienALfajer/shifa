// Sign-in throttle (A-01a criterion 7): 5 failures per phone and 30 per IP within 15 minutes lock
// that phone or IP for 15 minutes. Rows are keyed by an HMAC of the value (AUTH_HMAC_KEY), never
// the phone or IP itself; an unknown phone counts like a known one (no enumeration by lock).
import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type AuthDb, authThrottle } from '@shifa/db';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { AUTH_DB, IDENTITY_CONFIG, type IdentitySecrets } from './tokens.ts';

export const PHONE_FAILURE_LIMIT = 5;
export const IP_FAILURE_LIMIT = 30;
export const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;

export type ThrottleKind = 'phone' | 'ip';

export interface ThrottleKeys {
  /** E.164 phone as normalised. */
  phone: string;
  /** Socket address. */
  ip: string;
}

/** A lock in force: which kind, and when it ends. */
export interface Lock {
  kind: ThrottleKind;
  until: Date;
}

const LIMIT: Record<ThrottleKind, number> = { phone: PHONE_FAILURE_LIMIT, ip: IP_FAILURE_LIMIT };

@Injectable()
export class ThrottleService {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(IDENTITY_CONFIG) private readonly secrets: IdentitySecrets,
  ) {}

  #hash(kind: ThrottleKind, value: string): string {
    return createHmac('sha256', this.secrets.hmacKey).update(`${kind}:${value}`).digest('hex');
  }

  /** The lock in force for the IP or the phone (the IP first), or null. */
  async lockFor(keys: ThrottleKeys, now: Date): Promise<Lock | null> {
    const ip = this.#hash('ip', keys.ip);
    const phone = this.#hash('phone', keys.phone);
    const rows = await this.authDb.withAuth((tx) =>
      tx
        .select({ kind: authThrottle.kind, lockedUntil: authThrottle.lockedUntil })
        .from(authThrottle)
        .where(and(inArray(authThrottle.keyHash, [ip, phone]), gt(authThrottle.lockedUntil, now))),
    );
    const find = (kind: ThrottleKind) => rows.find((r) => r.kind === kind)?.lockedUntil ?? null;
    const ipUntil = find('ip');
    if (ipUntil) return { kind: 'ip', until: ipUntil };
    const phoneUntil = find('phone');
    return phoneUntil ? { kind: 'phone', until: phoneUntil } : null;
  }

  /**
   * Counts one failure for the phone and the IP (or only `kinds`), starting a new window when the
   * last one is over 15 minutes old. Returns the locks this failure started (empty when none did).
   */
  async recordFailure(
    keys: ThrottleKeys,
    now: Date,
    kinds: readonly ThrottleKind[] = ['ip', 'phone'],
  ): Promise<Lock[]> {
    const started: Lock[] = [];
    await this.authDb.withAuth(async (tx) => {
      for (const kind of kinds) {
        const cutoff = new Date(now.getTime() - THROTTLE_WINDOW_MS);
        const lockEnd = new Date(now.getTime() + LOCK_MS);
        const expired = sql`${authThrottle.windowStart} <= ${cutoff.toISOString()}::timestamptz`;
        const failures = sql`case when ${expired} then 1 else ${authThrottle.failures} + 1 end`;
        const [row] = await tx
          .insert(authThrottle)
          .values({
            kind,
            keyHash: this.#hash(kind, keys[kind]),
            windowStart: now,
            failures: 1,
            lockedUntil: LIMIT[kind] <= 1 ? lockEnd : null,
          })
          .onConflictDoUpdate({
            target: [authThrottle.kind, authThrottle.keyHash],
            set: {
              windowStart: sql`case when ${expired} then ${now.toISOString()}::timestamptz else ${authThrottle.windowStart} end`,
              failures,
              lockedUntil: sql`case when (${failures}) >= ${LIMIT[kind]} then ${lockEnd.toISOString()}::timestamptz else ${authThrottle.lockedUntil} end`,
            },
          })
          .returning({ failures: authThrottle.failures, lockedUntil: authThrottle.lockedUntil });
        if (row?.lockedUntil && row.failures === LIMIT[kind]) {
          started.push({ kind, until: row.lockedUntil });
        }
      }
    });
    return started;
  }

  /** A successful sign-in clears the phone's window (the IP's stays). */
  async clearPhone(phone: string): Promise<void> {
    const keyHash = this.#hash('phone', phone);
    await this.authDb.withAuth((tx) =>
      tx
        .delete(authThrottle)
        .where(and(eq(authThrottle.kind, 'phone'), eq(authThrottle.keyHash, keyHash))),
    );
  }
}
