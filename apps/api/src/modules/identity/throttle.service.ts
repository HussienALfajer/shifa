// Sign-in throttle (A-01a criterion 7): 5 attempts per phone and 30 per IP within a 15-minute
// window lock that phone or IP for 15 minutes. Rows are keyed by an HMAC of the value
// (AUTH_HMAC_KEY), never the phone or IP itself; an unknown phone counts like a known one.
//
// Every attempt reserves its slot before any password is checked (review B1): the rows are locked
// (SELECT … FOR UPDATE) and counted in one transaction, so parallel attempts cannot all pass a
// check made before any of them was counted. The attempt that reaches a limit sets the lock at
// once; if its password then turns out right, the success lifts it again.
import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type AuthDb, authThrottle, type Tx } from '@shifa/db';
import { and, eq, sql } from 'drizzle-orm';
import { ipKey } from './ip-key.ts';
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

/** A lock: which kind, and when it ends. */
export interface Lock {
  kind: ThrottleKind;
  until: Date;
}

/** The outcome of reserving an attempt. */
export interface Reservation {
  /**
   * A lock already in force: no password may be checked. `first` is true for the first refusal
   * of that lock only, so a refused attempt writes at most one audit row per lock (review M2).
   */
  refused: (Lock & { first: boolean }) | null;
  /** Locks this attempt set (an IP lock even when the phone then refused it). */
  started: Lock[];
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

  /**
   * Counts this attempt against the IP, then the phone (an IP lock stops before the phone is
   * counted; a phone lock still costs the IP an attempt, so a locked phone sprayed from one
   * address trips the IP block).
   */
  reserve(keys: ThrottleKeys, now: Date): Promise<Reservation> {
    return this.authDb.withAuth(async (tx) => {
      const started: Lock[] = [];
      for (const kind of ['ip', 'phone'] as const) {
        const outcome = await this.#count(tx, kind, keys[kind], now);
        if ('refused' in outcome) return { refused: outcome.refused, started };
        if (outcome.started) started.push(outcome.started);
      }
      return { refused: null, started };
    });
  }

  /**
   * A successful attempt: the phone's window is cleared, and the IP gets its attempt back (and
   * loses the lock this attempt set, if it set one).
   */
  async succeeded(keys: ThrottleKeys, started: readonly Lock[]): Promise<void> {
    const phone = this.#hash('phone', keys.phone);
    const ip = this.#hash('ip', ipKey(keys.ip));
    const ipLockStarted = started.some((lock) => lock.kind === 'ip');
    // IP row first, then the phone row: the order reserve() locks them in (no deadlock, L2).
    await this.authDb.withAuth(async (tx) => {
      await tx
        .update(authThrottle)
        .set({
          failures: sql`greatest(${authThrottle.failures} - 1, 0)`,
          ...(ipLockStarted ? { lockedUntil: null } : {}),
        })
        .where(and(eq(authThrottle.kind, 'ip'), eq(authThrottle.keyHash, ip)));
      await tx
        .delete(authThrottle)
        .where(and(eq(authThrottle.kind, 'phone'), eq(authThrottle.keyHash, phone)));
    });
  }

  async #count(
    tx: Tx,
    kind: ThrottleKind,
    value: string,
    now: Date,
  ): Promise<{ refused: Lock & { first: boolean } } | { started: Lock | null }> {
    const keyHash = this.#hash(kind, kind === 'ip' ? ipKey(value) : value);
    const where = and(eq(authThrottle.kind, kind), eq(authThrottle.keyHash, keyHash));
    await tx
      .insert(authThrottle)
      .values({ kind, keyHash, windowStart: now, failures: 0 })
      .onConflictDoNothing({ target: [authThrottle.kind, authThrottle.keyHash] });
    const [row] = await tx.select().from(authThrottle).where(where).for('update');
    if (!row) throw new Error('throttle row missing after insert');
    if (row.lockedUntil && row.lockedUntil > now) {
      // The first refusal moves the count past the limit; later ones change nothing.
      const first = row.failures <= LIMIT[kind];
      if (first)
        await tx
          .update(authThrottle)
          .set({ failures: LIMIT[kind] + 1 })
          .where(where);
      return { refused: { kind, until: row.lockedUntil, first } };
    }
    const windowOver = now.getTime() - row.windowStart.getTime() >= THROTTLE_WINDOW_MS;
    const failures = windowOver ? 1 : row.failures + 1;
    const lockedUntil = failures >= LIMIT[kind] ? new Date(now.getTime() + LOCK_MS) : null;
    await tx
      .update(authThrottle)
      .set({ windowStart: windowOver ? now : row.windowStart, failures, lockedUntil })
      .where(where);
    return { started: lockedUntil ? { kind, until: lockedUntil } : null };
  }
}
