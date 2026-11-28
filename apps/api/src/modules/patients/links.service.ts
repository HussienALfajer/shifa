// The registration form's reads (spec A-03 criteria 7, 9, 10, 29; slice A-03-04): the duplicate
// check, the family on a phone and the doctors to pick. Each runs in the scope the guard checked;
// none writes an audit row (criterion 18: only the summary's read is audited, A-03-07). The names
// and phones they read arrive in request bodies and are never logged.
import { Inject, Injectable } from '@nestjs/common';
import type {
  DuplicateCandidates,
  DuplicateCheckRequest,
  PatientDoctors,
  PatientFamily,
  PatientFamilyRequest,
} from '@shifa/contracts';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { damascusToday } from './birth.ts';
import { phoneAt } from './chart-input.ts';
import { doctorChoices } from './doctors.ts';
import { candidateView, duplicateQuery, findCandidates } from './duplicates.ts';
import { familyOn } from './family.ts';

@Injectable()
export class PatientLinksService {
  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Criterion 7: at most 5 candidates for the fields typed so far. */
  duplicates(scope: RequestScope, input: DuplicateCheckRequest): Promise<DuplicateCandidates> {
    const query = duplicateQuery(input, damascusToday(this.clock));
    return this.tenants.run(scope, async (tx) => ({
      candidates: (await findCandidates(tx, query)).map(candidateView),
    }));
  }

  /** Criteria 9, 29: the holder and members on the phone (400 on `body.phone` until complete). */
  family(scope: RequestScope, input: PatientFamilyRequest): Promise<PatientFamily> {
    const phone = phoneAt(input.phone, 'body.phone');
    return this.tenants.run(scope, (tx) => familyOn(tx, phone, input.excludeId ?? null));
  }

  /** Criterion 10: the clinic's doctors, active ones offered. */
  doctors(scope: RequestScope): Promise<PatientDoctors> {
    return this.tenants.run(scope, async (tx) => ({ doctors: await doctorChoices(tx) }));
  }
}
