// Charts (spec A-03 criteria 1–3, 7, 9, 10, 12, 13, 16, 17, 20, 22, 27–29, 32; slices A-03-02,
// A-03-04, A-03-06). Every call runs in the scope the guard checked (TenantDb) and writes its
// audit row in the same transaction. Audit data holds no name, phone, date, previous number or
// field value: a chart's id, an edit's changed keys and custom field keys, the candidate ids of a
// chart registered anyway, the member ids of a doctor change. No read audit yet:
// `GET /patients/:id` gains its `patient.chart_viewed` row in A-03-07, before any screen reads a
// chart (A-03-09). Every save that sets a name part rewrites the chart's name key and tokens in
// the same transaction (A-03-03, ADR-0052). A save that sets the phone decides the relation under
// a lock on that phone (family.ts); a save that sets a name, the phone or the birth re-checks
// duplicates (duplicates.ts); treating doctors are set in doctors.ts; custom field values in
// fields/field-values.ts, after the purge of expired fields. Every answer shows the fields the
// member's roles (in the scope) may view.
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
import {
  audit,
  EDITABLE,
  type Editable,
  editOf,
  optionalPart,
  optionalPhone,
  phoneAt,
  previousOf,
} from './chart-input.ts';
import {
  CHART_KEY,
  type ChartReader,
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
import { doctorRows, registeringDoctor, setTreatingDoctors } from './doctors.ts';
import { acknowledgedCandidates, duplicateQuery } from './duplicates.ts';
import { relationOn, restoredRelation } from './family.ts';
import { loadFields, purgeExpired } from './fields/field-store.ts';
import { planFieldValues, writeFieldValues } from './fields/field-values.ts';
import { namesChanged, writeNameKey } from './name-keys.ts';

/**
 * The fields whose change re-checks duplicates (criterion 7; contract row "Edit": the ids are sent
 * only when the name or phone changed, so a birth correction alone is not re-checked).
 */
const DUPLICATE_KEYS: readonly Editable[] = [
  'givenName',
  'fatherName',
  'familyName',
  'contactPhone',
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

/** The custom field keys written, as audit data (none: no entry). */
const fieldData = (keys: readonly string[]) => (keys.length > 0 ? { fields: keys } : {});

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
   * Criteria 1–3, 7, 9, 10, 16, 17: the chart with the clinic's next file number, its relation on
   * the phone, its treating doctors (a doctor who registers is added) and its custom field values.
   * The same id and body again returns the stored chart and takes no number; another body with that
   * id answers 409.
   */
  async create(
    scope: RequestScope,
    roles: readonly string[],
    input: CreatePatientRequest,
    requestId: string,
  ): Promise<PatientChart> {
    const contactPhone = phoneAt(input.contactPhone, 'body.contactPhone');
    const secondPhone = optionalPhone(input.secondPhone, 'body.secondPhone') ?? null;
    const birth = birthOf(input, damascusToday(this.clock));
    if (!birth) throw new RequestValidationError([{ path: 'body.birthDate', code: 'custom' }]);
    const hash = requestHash(input);
    const reader = this.#reader(roles);
    // Only the member who registered it replays (security review M1): the hash covers `fields`, so
    // another member's guesses would learn values they may not view.
    const replay = (tx: Tx, row: ChartRow) => {
      if (row.createdBy !== scope.userId || row.createHash !== hash) {
        throw new ApiError(409, 'patient_id_taken');
      }
      return chartView(tx, row, reader);
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
        await purgeExpired(tx, scope.tenantId, reader.now, requestId);
        const fields = await loadFields(tx, reader.now);
        const values = await planFieldValues(tx, roles, null, fields, input.fields);
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
        const at = nextStamp(reader.now);
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
        const writer = { tenantId: scope.tenantId, userId: scope.userId, at };
        const written = await writeFieldValues(tx, writer, row.id, values);
        const doctor = await registeringDoctor(tx, scope.userId);
        await setTreatingDoctors(tx, scope, row.id, [
          ...(input.treatingDoctorIds ?? []),
          ...(doctor ? [doctor] : []),
        ]);
        await audit(tx, scope, 'patient.created', row.id, requestId, fieldData(written));
        if (anyway.length > 0) {
          await audit(tx, scope, 'patient.duplicate_registered', row.id, requestId, {
            candidateIds: anyway,
          });
        }
        return chartView(tx, row, reader);
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
  get(scope: RequestScope, roles: readonly string[], id: string): Promise<PatientChart> {
    return this.tenants.run(scope, async (tx) => {
      const row = await findChart(tx, id);
      if (!row) throw new NotFoundException();
      return chartView(tx, row, this.#reader(roles));
    });
  }

  /**
   * Criteria 7, 9, 10, 12, 16, 17, 28: the fields given, with the registration's checks; 409 on a
   * stale save. A new phone moves the chart to that family; `treatingDoctorIds` replaces the list;
   * custom field keys sent are written, `null` clears.
   */
  async update(
    scope: RequestScope,
    roles: readonly string[],
    id: string,
    input: UpdatePatientRequest,
    requestId: string,
  ): Promise<PatientChart> {
    const next = editOf(input);
    const birth = birthOf(input, damascusToday(this.clock));
    if (birth)
      Object.assign(next, { birthDate: birth.birthDate, birthDateEstimated: birth.estimated });
    const reader = this.#reader(roles);
    try {
      return await this.tenants.run(scope, async (tx) => {
        const current = await this.#writable(tx, id, input.expectedUpdatedAt);
        const at = nextStamp(reader.now, current.updatedAt);
        await purgeExpired(tx, scope.tenantId, reader.now, requestId);
        const fields = input.fields === undefined ? [] : await loadFields(tx, reader.now);
        const values = input.fields && (await planFieldValues(tx, roles, id, fields, input.fields));
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
        const anyway = changed.some((key) => DUPLICATE_KEYS.includes(key))
          ? await acknowledgedCandidates(
              tx,
              savedQuery({ ...current, ...next, id }),
              input.acknowledgedCandidateIds,
            )
          : [];
        const writer = { tenantId: scope.tenantId, userId: scope.userId, at };
        const written = values ? await writeFieldValues(tx, writer, id, values) : [];
        const doctors =
          input.treatingDoctorIds === undefined
            ? { added: [], removed: [] }
            : await setTreatingDoctors(tx, scope, id, input.treatingDoctorIds);
        const doctorsChanged = doctors.added.length + doctors.removed.length > 0;
        if (changed.length === 0 && written.length === 0 && !doctorsChanged) {
          return chartView(tx, current, reader);
        }
        const [row] = await tx
          .update(patient)
          .set({ ...(changed.length > 0 ? next : {}), updatedBy: scope.userId, updatedAt: at })
          .where(eq(patient.id, id))
          .returning();
        if (!row) throw new NotFoundException();
        if (namesChanged(current, next)) await writeNameKey(tx, row);
        if (changed.length > 0 || written.length > 0) {
          await audit(tx, scope, 'patient.edited', id, requestId, {
            ...Object.fromEntries(changed.map((key) => [key, true])),
            ...fieldData(written),
          });
        }
        if (anyway.length > 0) {
          await audit(tx, scope, 'patient.duplicate_registered', id, requestId, {
            candidateIds: anyway,
          });
        }
        // At most DOCTOR_IDS_PER_ROW ids a row, so the row stays within the 1 kB audit limit.
        for (const part of doctorRows(doctors)) {
          await audit(tx, scope, 'patient.doctors_changed', id, requestId, { ...part });
        }
        return chartView(tx, row, reader);
      });
    } catch (err) {
      if (violates(err, PREVIOUS_NUMBER_KEY)) throw previousTaken();
      throw err;
    }
  }

  /** Criteria 13, 28: the owner archives an active chart; it is never deleted. */
  archive(
    scope: RequestScope,
    roles: readonly string[],
    id: string,
    expectedUpdatedAt: string,
    requestId: string,
  ): Promise<PatientChart> {
    return this.tenants.run(scope, async (tx) => {
      const current = await this.#writable(tx, id, expectedUpdatedAt);
      const reader = this.#reader(roles);
      const at = nextStamp(reader.now, current.updatedAt);
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
      return chartView(tx, row, reader);
    });
  }

  /** Criterion 13: the owner restores an archived chart. */
  restore(
    scope: RequestScope,
    roles: readonly string[],
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
      const reader = this.#reader(roles);
      const relation = await restoredRelation(tx, scope.tenantId, current);
      const [row] = await tx
        .update(patient)
        .set({
          relation,
          state: 'active',
          archivedAt: null,
          archivedBy: null,
          updatedBy: scope.userId,
          updatedAt: nextStamp(reader.now, current.updatedAt),
        })
        .where(eq(patient.id, id))
        .returning();
      if (!row) throw new NotFoundException();
      await audit(
        tx,
        scope,
        'patient.restored',
        id,
        requestId,
        relation === current.relation ? {} : { relation: true },
      );
      return chartView(tx, row, reader);
    });
  }

  /** The reader of this request's answers: the member's roles and the clock's now. */
  #reader(roles: readonly string[]): ChartReader {
    return { roles, now: this.clock.now() };
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
