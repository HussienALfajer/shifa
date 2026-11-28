// The registration form's reads (spec A-03 criteria 7, 9, 10, 29; slice A-03-04): the duplicate
// check, the family on a phone and the doctors to pick. Each runs in the scope the guard checked;
// none writes an audit row (criterion 18: only the summary's read is audited, A-03-07). The names
// and phones they read arrive in request bodies and are never logged. The duplicate check and the
// family preview answer charts' cards, so they share a per-member budget like search's (security
// review M1: no scraping around search's limit) and a statement timeout.
import { Inject, Injectable } from '@nestjs/common';
import type {
  DuplicateCandidates,
  DuplicateCheckRequest,
  PatientDoctors,
  PatientFamily,
  PatientFamilyRequest,
} from '@shifa/contracts';
import type { Tx } from '@shifa/db';
import { sql } from 'drizzle-orm';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { ApiError } from '../../platform/errors.ts';
import { damascusToday } from './birth.ts';
import { phoneAt } from './chart-input.ts';
import { doctorChoices } from './doctors.ts';
import { candidateView, duplicateQuery, findCandidates } from './duplicates.ts';
import { familyOn } from './family.ts';
import { MemberLimit } from './member-limit.ts';
import { backfillNameKeys } from './name-keys.ts';

/** Duplicate checks and family previews a member may make per window, together. */
export const FORM_CHECK_LIMIT = { max: 60, windowMs: 60_000 } as const;
/** Stale name keys written before a duplicate check. */
const BACKFILL_BATCH = 200;
/** One statement may take this long (ms) before PostgreSQL stops it. */
const STATEMENT_TIMEOUT_MS = 2000;

const capped = (tx: Tx) =>
  tx.execute(sql`select set_config('statement_timeout', ${String(STATEMENT_TIMEOUT_MS)}, true)`);

@Injectable()
export class PatientLinksService {
  readonly #limit: MemberLimit;

  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.#limit = new MemberLimit(FORM_CHECK_LIMIT, clock);
  }

  /**
   * Criterion 7: at most 5 candidates for the fields typed so far. As search does, a batch of the
   * clinic's stale name tokens is written first (its own transaction; skipped in a read-only
   * support scope), so charts under an older key version are not missed (reviewer N6).
   * `onLimited` is told (ids only) before a 429.
   */
  async duplicates(
    scope: RequestScope,
    input: DuplicateCheckRequest,
    onLimited: () => void,
  ): Promise<DuplicateCandidates> {
    const query = duplicateQuery(input, damascusToday(this.clock));
    this.#take(scope, onLimited);
    if (scope.readOnly !== true) {
      await this.tenants.run(scope, (tx) => backfillNameKeys(tx, BACKFILL_BATCH));
    }
    return this.tenants.run(scope, async (tx) => {
      await capped(tx);
      return { candidates: (await findCandidates(tx, query)).map(candidateView) };
    });
  }

  /** Criteria 9, 29: the holder and members on the phone (400 on `body.phone` until complete). */
  family(
    scope: RequestScope,
    input: PatientFamilyRequest,
    onLimited: () => void,
  ): Promise<PatientFamily> {
    const phone = phoneAt(input.phone, 'body.phone');
    this.#take(scope, onLimited);
    return this.tenants.run(scope, async (tx) => {
      await capped(tx);
      return familyOn(tx, phone, input.excludeId ?? null);
    });
  }

  /** Criterion 10: the clinic's doctors, active ones offered. */
  doctors(scope: RequestScope): Promise<PatientDoctors> {
    return this.tenants.run(scope, async (tx) => ({ doctors: await doctorChoices(tx) }));
  }

  #take(scope: RequestScope, onLimited: () => void): void {
    if (this.#limit.take(scope)) return;
    onLimited();
    throw new ApiError(429, 'rate_limited');
  }
}
