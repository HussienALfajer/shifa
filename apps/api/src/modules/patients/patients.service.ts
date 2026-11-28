// Charts (spec A-03 criteria 1–3, 7, 9, 10, 12, 13, 20, 22, 27–29, 32; slices A-03-02, A-03-04).
// Every call runs in the scope the guard checked (TenantDb) and writes its audit row in the same
// transaction. Audit data holds no name, phone, date or previous number: a chart's id, an edit's
// changed keys, the candidate ids of a chart registered anyway, the member ids of a doctor change.
// No read audit yet: `GET /patients/:id` gains its `patient.chart_viewed` row in A-03-07, before
// any screen reads a chart (A-03-09). Every save that sets a name part rewrites the chart's name
// key and tokens in the same transaction (A-03-03, ADR-0052). A save that sets the phone decides
// the relation under a lock on that phone (family.ts); a save that sets a name, the phone or the
// birth re-checks duplicates (duplicates.ts); treating doctors are set in doctors.ts.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CreatePatientRequest,
  cleanPatientNamePart,
  type PatientChart,
  type PatientCount,
  type UpdatePatientRequest,
} from '@shifa/contracts';
import { patient, type Tx } from '@shifa/db';
import { eq, sql } from 'drizzle-orm';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { birthOf, damascusToday } from './birth.ts';
import { audit, optionalPart, optionalPhone, phoneAt, previousOf } from './chart-input.ts';
import {
  CHART_KEY,
  type ChartRow,
  chartView,
  findChart,
  nextStamp,
  PREVIOUS_NUMBER_KEY,
  registeringBranch,
  requestHash,
  staleError,
  takeFileNumber,
  violates,
} from './charts.ts';
import { registeringDoctor, setTreatingDoctors } from './doctors.ts';
import { acknowledgedCandidates, duplicateQuery } from './duplicates.ts';
import { relationOn } from './family.ts';
import { namesChanged, writeNameKey } from './name-keys.ts';

/** The identity fields an edit may change; the audit names the ones that did. */
const EDITABLE = [
  'givenName',
  'fatherName',
  'familyName',
  'motherName',
  'contactPhone',
  'secondPhone',
  'sex',
  'birthDate',
  'previousFileNumber',
  'relation',
] as const;
type Editable = (typeof EDITABLE)[number];
/** The fields whose change re-checks duplicates (criterion 7). */
const DUPLICATE_KEYS: readonly Editable[] = [
  'givenName',
  'fatherName',
  'familyName',
  'contactPhone',
  'birthDate',
];

const previousTaken = () => new ApiError(409, 'previous_file_number_taken');

/** The duplicate check of a chart's identity as it will be saved. */
function savedQuery(
  chart: Pick<
    ChartRow,
    'id' | 'givenName' | 'fatherName' | 'familyName' | 'contactPhone' | 'birthDate'
  >,
) {
  return duplicateQuery(
    {
      givenName: chart.givenName,
      fatherName: chart.fatherName,
      familyName: chart.familyName,
      contactPhone: chart.contactPhone,
      birthDate: chart.birthDate,
      excludeId: chart.id,
    },
    chart.birthDate,
  );
}

@Injectable()
export class PatientsService {
  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Active and archived charts (criterion 22); `archived` only for those who may archive. */
  count(scope: RequestScope, withArchived: boolean): Promise<PatientCount> {
    return this.tenants.run(scope, async (tx) => {
      const rows = await tx
        .select({ state: patient.state, count: sql<number>`count(*)::int` })
        .from(patient)
        .groupBy(patient.state);
      const of = (state: ChartRow['state']) => rows.find((r) => r.state === state)?.count ?? 0;
      return { active: of('active'), archived: withArchived ? of('archived') : 0 };
    });
  }

  /**
   * Criteria 1–3, 7, 9, 10: the chart with the clinic's next file number, its relation on the
   * phone and its treating doctors (a doctor who registers is added). The same id and body again
   * returns the stored chart and takes no number; another body with that id answers 409.
   */
  async create(
    scope: RequestScope,
    input: CreatePatientRequest,
    requestId: string,
  ): Promise<PatientChart> {
    const contactPhone = phoneAt(input.contactPhone, 'body.contactPhone');
    const secondPhone = optionalPhone(input.secondPhone, 'body.secondPhone') ?? null;
    const birth = birthOf(input, damascusToday(this.clock));
    if (!birth) throw new RequestValidationError([{ path: 'body.birthDate', code: 'custom' }]);
    const hash = requestHash(input);
    const replay = (tx: Tx, row: ChartRow) => {
      if (row.createHash !== hash) throw new ApiError(409, 'patient_id_taken');
      return chartView(tx, row);
    };
    const identity = {
      id: input.id,
      givenName: cleanPatientNamePart(input.givenName),
      fatherName: optionalPart(input.fatherName) ?? null,
      familyName: optionalPart(input.familyName) ?? null,
      contactPhone,
      birthDate: birth.birthDate,
    };
    try {
      return await this.tenants.run(scope, async (tx) => {
        const existing = await findChart(tx, input.id);
        if (existing) return replay(tx, existing);
        const relation = await relationOn(tx, scope.tenantId, contactPhone, input.id, {
          requested: input.relation,
          samePhone: false,
        });
        const anyway = await acknowledgedCandidates(
          tx,
          savedQuery(identity),
          input.acknowledgedCandidateIds,
        );
        const fileNumber = await takeFileNumber(tx, scope.tenantId);
        const at = nextStamp(this.clock.now());
        const [row] = await tx
          .insert(patient)
          .values({
            ...identity,
            tenantId: scope.tenantId,
            fileNumber,
            previousFileNumber: previousOf(input.previousFileNumber) ?? null,
            motherName: optionalPart(input.motherName) ?? null,
            secondPhone,
            sex: input.sex,
            birthDateEstimated: birth.estimated,
            relation,
            registeredBranchId: await registeringBranch(tx, scope.branchId),
            createHash: hash,
            createdBy: scope.userId,
            updatedBy: scope.userId,
            createdAt: at,
            updatedAt: at,
          })
          .returning();
        if (!row) throw new Error('chart not written');
        await writeNameKey(tx, row);
        const doctor = await registeringDoctor(tx, scope.userId);
        await setTreatingDoctors(tx, scope, row.id, [
          ...(input.treatingDoctorIds ?? []),
          ...(doctor ? [doctor] : []),
        ]);
        await audit(tx, scope, 'patient.created', row.id, requestId);
        if (anyway.length > 0) {
          await audit(tx, scope, 'patient.duplicate_registered', row.id, requestId, {
            candidateIds: anyway,
          });
        }
        return chartView(tx, row);
      });
    } catch (err) {
      if (violates(err, PREVIOUS_NUMBER_KEY)) throw previousTaken();
      // A save of the same id at the same moment won: answer as a replay of it.
      if (violates(err, CHART_KEY)) {
        return this.tenants.run(scope, async (tx) => {
          const row = await findChart(tx, input.id);
          if (!row) throw err;
          return replay(tx, row);
        });
      }
      throw err;
    }
  }

  /** Criterion 12: the summary (A-03-07 adds the read audit). */
  get(scope: RequestScope, id: string): Promise<PatientChart> {
    return this.tenants.run(scope, async (tx) => {
      const row = await findChart(tx, id);
      if (!row) throw new NotFoundException();
      return chartView(tx, row);
    });
  }

  /**
   * Criteria 7, 9, 10, 12, 28: the fields given, with the registration's checks; 409 on a stale
   * save. A new phone moves the chart to that family; `treatingDoctorIds` replaces the list.
   */
  async update(
    scope: RequestScope,
    id: string,
    input: UpdatePatientRequest,
    requestId: string,
  ): Promise<PatientChart> {
    const next = editOf(input);
    const birth = birthOf(input, damascusToday(this.clock));
    if (birth)
      Object.assign(next, { birthDate: birth.birthDate, birthDateEstimated: birth.estimated });
    try {
      return await this.tenants.run(scope, async (tx) => {
        const current = await this.#writable(tx, id, input.expectedUpdatedAt);
        const phone = next.contactPhone ?? current.contactPhone;
        const moved = phone !== current.contactPhone;
        if (moved || input.relation !== undefined) {
          next.relation = await relationOn(tx, scope.tenantId, phone, id, {
            requested: input.relation,
            current: current.relation,
            samePhone: !moved,
          });
        }
        const changed = EDITABLE.filter(
          (key) =>
            (key in next && next[key] !== current[key]) ||
            (key === 'birthDate' &&
              next.birthDateEstimated !== undefined &&
              next.birthDateEstimated !== current.birthDateEstimated),
        );
        if (changed.some((key) => DUPLICATE_KEYS.includes(key))) {
          await acknowledgedCandidates(
            tx,
            savedQuery({ ...current, ...next, id }),
            input.acknowledgedCandidateIds,
          );
        }
        const doctors =
          input.treatingDoctorIds === undefined
            ? { added: [], removed: [] }
            : await setTreatingDoctors(tx, scope, id, input.treatingDoctorIds);
        const doctorsChanged = doctors.added.length + doctors.removed.length > 0;
        if (changed.length === 0 && !doctorsChanged) return chartView(tx, current);
        const [row] = await tx
          .update(patient)
          .set({
            ...(changed.length > 0 ? next : {}),
            updatedBy: scope.userId,
            updatedAt: nextStamp(this.clock.now(), current.updatedAt),
          })
          .where(eq(patient.id, id))
          .returning();
        if (!row) throw new NotFoundException();
        if (namesChanged(current, next)) await writeNameKey(tx, row);
        if (changed.length > 0) {
          await audit(
            tx,
            scope,
            'patient.edited',
            id,
            requestId,
            Object.fromEntries(changed.map((key) => [key, true])),
          );
        }
        if (doctorsChanged) {
          await audit(tx, scope, 'patient.doctors_changed', id, requestId, { ...doctors });
        }
        return chartView(tx, row);
      });
    } catch (err) {
      if (violates(err, PREVIOUS_NUMBER_KEY)) throw previousTaken();
      throw err;
    }
  }

  /** Criteria 13, 28: the owner archives an active chart; it is never deleted. */
  archive(
    scope: RequestScope,
    id: string,
    expectedUpdatedAt: string,
    requestId: string,
  ): Promise<PatientChart> {
    return this.tenants.run(scope, async (tx) => {
      const current = await this.#writable(tx, id, expectedUpdatedAt);
      const at = nextStamp(this.clock.now(), current.updatedAt);
      const [row] = await tx
        .update(patient)
        .set({
          state: 'archived',
          archivedAt: at,
          archivedBy: scope.userId,
          updatedBy: scope.userId,
          updatedAt: at,
        })
        .where(eq(patient.id, id))
        .returning();
      if (!row) throw new NotFoundException();
      await audit(tx, scope, 'patient.archived', id, requestId);
      return chartView(tx, row);
    });
  }

  /** Criterion 13: the owner restores an archived chart. */
  restore(
    scope: RequestScope,
    id: string,
    expectedUpdatedAt: string,
    requestId: string,
  ): Promise<PatientChart> {
    return this.tenants.run(scope, async (tx) => {
      const current = await findChart(tx, id, { lock: true });
      if (!current) throw new NotFoundException();
      if (current.state !== 'archived') throw new ApiError(409, 'patient_not_archived');
      if (Date.parse(expectedUpdatedAt) !== current.updatedAt.getTime()) {
        throw await staleError(tx, current);
      }
      const [row] = await tx
        .update(patient)
        .set({
          state: 'active',
          archivedAt: null,
          archivedBy: null,
          updatedBy: scope.userId,
          updatedAt: nextStamp(this.clock.now(), current.updatedAt),
        })
        .where(eq(patient.id, id))
        .returning();
      if (!row) throw new NotFoundException();
      await audit(tx, scope, 'patient.restored', id, requestId);
      return chartView(tx, row);
    });
  }

  /** The chart, locked: active, and unchanged since `expectedUpdatedAt` (else 409). */
  async #writable(tx: Tx, id: string, expectedUpdatedAt: string): Promise<ChartRow> {
    const current = await findChart(tx, id, { lock: true });
    if (!current) throw new NotFoundException();
    if (current.state === 'merged') throw new ApiError(409, 'patient_merged');
    if (current.state === 'archived') throw new ApiError(409, 'patient_archived');
    if (Date.parse(expectedUpdatedAt) !== current.updatedAt.getTime()) {
      throw await staleError(tx, current);
    }
    return current;
  }
}

/** The identity fields an edit sets, as stored (the birth and relation are added by the caller). */
function editOf(
  input: UpdatePatientRequest,
): Partial<Pick<ChartRow, Editable | 'birthDateEstimated'>> {
  return {
    ...(input.givenName === undefined ? {} : { givenName: cleanPatientNamePart(input.givenName) }),
    ...(input.fatherName === undefined
      ? {}
      : { fatherName: optionalPart(input.fatherName) ?? null }),
    ...(input.familyName === undefined
      ? {}
      : { familyName: optionalPart(input.familyName) ?? null }),
    ...(input.motherName === undefined
      ? {}
      : { motherName: optionalPart(input.motherName) ?? null }),
    ...(input.contactPhone === undefined
      ? {}
      : { contactPhone: phoneAt(input.contactPhone, 'body.contactPhone') }),
    ...(input.secondPhone === undefined
      ? {}
      : { secondPhone: optionalPhone(input.secondPhone, 'body.secondPhone') ?? null }),
    ...(input.sex === undefined ? {} : { sex: input.sex }),
    ...(input.previousFileNumber === undefined
      ? {}
      : { previousFileNumber: previousOf(input.previousFileNumber) ?? null }),
  };
}
