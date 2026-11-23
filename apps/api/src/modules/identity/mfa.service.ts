// TOTP enrolment and the challenge (A-01a criteria 11, 12): a code is accepted within ±1 step and
// never twice (the last accepted step is stored; nothing at or before it passes again); five
// wrong codes lock MFA for 15 min; a recovery code is single use; at enrolment a code 2–10 steps
// off answers `clock_skew` instead of `invalid_code`. Every attempt locks the person's
// two_factor row (FOR UPDATE), so parallel attempts cannot share a code or outrun the lock. A
// failure is committed before it is answered. The session is rotated after either success.
import { Inject, Injectable } from '@nestjs/common';
import type { MfaEnrolled, SessionView, TotpChallenge, TotpEnrolStart } from '@shifa/contracts';
import { type AuthDb, type Tx, twoFactor, user } from '@shifa/db';
import { and, eq } from 'drizzle-orm';
import type { Principal } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { ApiError } from '../../platform/errors.ts';
import { IdentityAudit } from './identity-audit.ts';
import { openSecret, sealSecret } from './secret-box.ts';
import { SessionIssuer } from './session-issuer.ts';
import { SessionsService } from './sessions.service.ts';
import { AUTH_DB, IDENTITY_CONFIG, type IdentitySecrets } from './tokens.ts';
import {
  base32Encode,
  matchStep,
  newRecoveryCodes,
  newTotpSecret,
  otpauthUri,
  recoveryCodeHash,
  TOTP_SKEW_HINT_WINDOW,
  TOTP_WINDOW,
} from './totp.ts';

export const MFA_MAX_FAILURES = 5;
export const MFA_LOCK_MS = 15 * 60_000;

type FactorRow = typeof twoFactor.$inferSelect;

/** What one attempt decided, committed before the answer. */
type Outcome = { ok: true; recoveryCodes?: string[] } | { ok: false; error: ApiError };

export interface MfaMeta {
  requestId: string;
}

@Injectable()
export class MfaService {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(IDENTITY_CONFIG) private readonly secrets: IdentitySecrets,
    @Inject(IdentityAudit) private readonly audit: IdentityAudit,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(SessionIssuer) private readonly issuer: SessionIssuer,
  ) {}

  /** A new key; replaces an unconfirmed one but keeps its failure count and lock. */
  async enrolStart(principal: Principal): Promise<TotpEnrolStart> {
    const secret = newTotpSecret();
    const sealed = sealSecret(secret, this.secrets.betterAuthSecret);
    const now = this.clock.now();
    await this.authDb.withAuth(async (tx) => {
      const row = await lockRow(tx, principal.userId);
      if (row?.verified) throw new ApiError(409, 'conflict');
      if (row?.lockedUntil && row.lockedUntil > now) {
        throw new ApiError(429, 'mfa_locked', row.lockedUntil);
      }
      if (row) {
        await tx.update(twoFactor).set({ secret: sealed }).where(eq(twoFactor.id, row.id));
      } else {
        await tx.insert(twoFactor).values({
          userId: principal.userId,
          secret: sealed,
          backupCodes: '[]',
          verified: false,
          failedVerificationCount: 0,
        });
      }
    });
    const manualKey = base32Encode(secret);
    return { otpauthUri: otpauthUri(manualKey), manualKey };
  }

  async enrolConfirm(
    principal: Principal,
    code: string,
    meta: MfaMeta,
  ): Promise<{ body: MfaEnrolled; cookie: string }> {
    const now = this.clock.now();
    const outcome = await this.authDb.withAuth(async (tx): Promise<Outcome> => {
      const row = await lockRow(tx, principal.userId);
      if (!row || row.verified) return { ok: false, error: new ApiError(409, 'conflict') };
      const locked = lockError(row, now);
      if (locked) return { ok: false, error: locked };
      const secret = openSecret(row.secret, this.secrets.betterAuthSecret);
      const step = matchStep(secret, code, now, TOTP_WINDOW);
      if (step === null) {
        const skewed = matchStep(secret, code, now, TOTP_SKEW_HINT_WINDOW) !== null;
        return this.#failure(tx, row, now, meta, skewed ? 'clock_skew' : 'invalid_code');
      }
      const recoveryCodes = newRecoveryCodes();
      await tx
        .update(twoFactor)
        .set({
          verified: true,
          lastUsedStep: step,
          backupCodes: JSON.stringify(recoveryCodes.map(recoveryCodeHash)),
          failedVerificationCount: 0,
          lockedUntil: null,
        })
        .where(eq(twoFactor.id, row.id));
      await tx
        .update(user)
        .set({ twoFactorEnabled: true, updatedAt: now })
        .where(eq(user.id, principal.userId));
      await this.audit.record(
        { event: 'auth.mfa_enrolled' },
        { actorId: principal.userId, targetId: principal.userId, requestId: meta.requestId },
        tx,
      );
      return { ok: true, recoveryCodes };
    });
    if (!outcome.ok) throw outcome.error;
    const { view, cookie } = await this.#rotate(principal, meta);
    return { body: { recoveryCodes: outcome.recoveryCodes ?? [], session: view }, cookie };
  }

  async challenge(
    principal: Principal,
    input: TotpChallenge,
    meta: MfaMeta,
  ): Promise<{ view: SessionView; cookie: string }> {
    if (principal.mfa !== 'pending') throw new ApiError(409, 'conflict');
    const now = this.clock.now();
    const outcome = await this.authDb.withAuth(async (tx): Promise<Outcome> => {
      const row = await lockRow(tx, principal.userId);
      if (!row?.verified) return { ok: false, error: new ApiError(409, 'conflict') };
      const locked = lockError(row, now);
      if (locked) return { ok: false, error: locked };
      const passed =
        input.method === 'totp'
          ? await this.#useTotp(tx, row, input.code, now)
          : await this.#useRecoveryCode(tx, row, input.code);
      if (!passed) return this.#failure(tx, row, now, meta, 'invalid_code');
      const ids = {
        actorId: principal.userId,
        targetId: principal.userId,
        requestId: meta.requestId,
      };
      if (input.method === 'recovery') {
        await this.audit.record({ event: 'auth.recovery_code_used' }, ids, tx);
      }
      await this.audit.record(
        { event: 'auth.mfa_passed', data: { method: input.method } },
        ids,
        tx,
      );
      return { ok: true };
    });
    if (!outcome.ok) throw outcome.error;
    return this.#rotate(principal, meta);
  }

  async #useTotp(tx: Tx, row: FactorRow, code: string, now: Date): Promise<boolean> {
    if (!/^[0-9]{6}$/.test(code)) return false;
    const secret = openSecret(row.secret, this.secrets.betterAuthSecret);
    const step = matchStep(secret, code, now, TOTP_WINDOW);
    // Never the same code twice, nor an older one (A-01a criterion 12).
    if (step === null || (row.lastUsedStep !== null && step <= row.lastUsedStep)) return false;
    await tx
      .update(twoFactor)
      .set({ lastUsedStep: step, failedVerificationCount: 0 })
      .where(eq(twoFactor.id, row.id));
    return true;
  }

  async #useRecoveryCode(tx: Tx, row: FactorRow, code: string): Promise<boolean> {
    const hashes = JSON.parse(row.backupCodes) as string[];
    const hash = recoveryCodeHash(code);
    const left = hashes.filter((h) => h !== hash);
    if (left.length === hashes.length) return false;
    await tx
      .update(twoFactor)
      .set({ backupCodes: JSON.stringify(left), failedVerificationCount: 0 })
      .where(eq(twoFactor.id, row.id));
    return true;
  }

  /** Counts a wrong code; the fifth locks MFA for 15 min (audited) and answers 429. */
  async #failure(
    tx: Tx,
    row: FactorRow,
    now: Date,
    meta: MfaMeta,
    code: 'invalid_code' | 'clock_skew',
  ): Promise<Outcome> {
    const failures = (row.failedVerificationCount ?? 0) + 1;
    if (failures < MFA_MAX_FAILURES) {
      await tx
        .update(twoFactor)
        .set({ failedVerificationCount: failures })
        .where(eq(twoFactor.id, row.id));
      return { ok: false, error: new ApiError(400, code) };
    }
    const until = new Date(now.getTime() + MFA_LOCK_MS);
    await tx
      .update(twoFactor)
      .set({ failedVerificationCount: 0, lockedUntil: until })
      .where(eq(twoFactor.id, row.id));
    await this.audit.record(
      { event: 'auth.mfa_locked' },
      { actorId: null, targetId: row.userId, requestId: meta.requestId },
      tx,
    );
    return { ok: false, error: new ApiError(429, 'mfa_locked', until) };
  }

  async #rotate(
    principal: Principal,
    meta: MfaMeta,
  ): Promise<{ view: SessionView; cookie: string }> {
    const issued = await this.issuer.rotate(principal, meta.requestId, true);
    const next = await this.sessions.authenticate(issued.token, meta.requestId);
    if (!next) throw new Error('the rotated session was not found');
    return { view: await this.sessions.view(next), cookie: issued.cookie };
  }
}

/** The person's two_factor row, locked for this transaction. */
async function lockRow(tx: Tx, userId: string): Promise<FactorRow | undefined> {
  const [row] = await tx
    .select()
    .from(twoFactor)
    .where(and(eq(twoFactor.userId, userId)))
    .for('update');
  return row;
}

function lockError(row: FactorRow, now: Date): ApiError | null {
  return row.lockedUntil && row.lockedUntil > now
    ? new ApiError(429, 'mfa_locked', row.lockedUntil)
    : null;
}
