// Charts (spec A-03 criteria 1–3, 12, 13, 20, 22, 28, 32; slice A-03-02). Every call runs in the
// scope the guard checked (TenantDb) and writes its audit row in the same transaction. Audit data
// holds no name, phone, date or previous number: a chart's id, and for an edit the changed keys.
// No read audit yet: `GET /patients/:id` gains its `patient.chart_viewed` row in A-03-07, before
// any screen reads a chart (A-03-09).
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CreatePatientRequest,
  cleanPatientNamePart,
  normalisePhone,
  type PatientChart,
  type PatientCount,
  type UpdatePatientRequest,
} from '@shifa/contracts';
import { type AuditEventName, auditEvent, patient, type Tx } from '@shifa/db';
import { eq, sql } from 'drizzle-orm';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { birthOf, damascusToday } from './birth.ts';
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
] as const;
type Editable = (typeof EDITABLE)[number];

/** E.164 for a required phone; 400 on its path when invalid. */
function phoneAt(input: string, path: string): string {
  const phone = normalisePhone(input);
  if (!phone.ok) throw new RequestValidationError([{ path, code: 'invalid_format' }]);
  return phone.e164;
}

/** `undefined`: not given; `null`: cleared; else E.164. */
function optionalPhone(input: string | null | undefined, path: string): string | null | undefined {
  return input === undefined || input === null ? input : phoneAt(input, path);
}

/** `undefined`: not given; `null`: cleared; else trimmed. */
function optionalPart(input: string | null | undefined): string | null | undefined {
  return input === undefined || input === null ? input : cleanPatientNamePart(input);
}

const previousOf = (input: string | null | undefined) =>
  input === undefined || input === null ? input : input.trim();

const previousTaken = () => new ApiError(409, 'previous_file_number_taken');

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
   * Criteria 1–3: the chart with the clinic's next file number. The same id and body again
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
    try {
      return await this.tenants.run(scope, async (tx) => {
        const existing = await findChart(tx, input.id);
        if (existing) return replay(tx, existing);
        const fileNumber = await takeFileNumber(tx, scope.tenantId);
        const at = nextStamp(this.clock.now());
        const [row] = await tx
          .insert(patient)
          .values({
            tenantId: scope.tenantId,
            id: input.id,
            fileNumber,
            previousFileNumber: previousOf(input.previousFileNumber) ?? null,
            givenName: cleanPatientNamePart(input.givenName),
            fatherName: optionalPart(input.fatherName) ?? null,
            familyName: optionalPart(input.familyName) ?? null,
            motherName: optionalPart(input.motherName) ?? null,
            contactPhone,
            secondPhone,
            sex: input.sex,
            birthDate: birth.birthDate,
            birthDateEstimated: birth.estimated,
            registeredBranchId: await registeringBranch(tx, scope.branchId),
            createHash: hash,
            createdBy: scope.userId,
            updatedBy: scope.userId,
            createdAt: at,
            updatedAt: at,
          })
          .returning();
        if (!row) throw new Error('chart not written');
        await audit(tx, scope, 'patient.created', row.id, requestId);
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

  /** Criterion 12: the identity part of the summary (A-03-07 adds the read audit). */
  get(scope: RequestScope, id: string): Promise<PatientChart> {
    return this.tenants.run(scope, async (tx) => {
      const row = await findChart(tx, id);
      if (!row) throw new NotFoundException();
      return chartView(tx, row);
    });
  }

  /** Criteria 12, 28: the fields given, with the registration's checks; 409 on a stale save. */
  async update(
    scope: RequestScope,
    id: string,
    input: UpdatePatientRequest,
    requestId: string,
  ): Promise<PatientChart> {
    const next: Partial<Pick<ChartRow, Editable | 'birthDateEstimated'>> = {
      ...(input.givenName === undefined
        ? {}
        : { givenName: cleanPatientNamePart(input.givenName) }),
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
    const birth = birthOf(input, damascusToday(this.clock));
    if (birth)
      Object.assign(next, { birthDate: birth.birthDate, birthDateEstimated: birth.estimated });
    try {
      return await this.tenants.run(scope, async (tx) => {
        const current = await this.#writable(tx, id, input.expectedUpdatedAt);
        const changed = EDITABLE.filter(
          (key) =>
            (key in next && next[key] !== current[key]) ||
            (key === 'birthDate' &&
              next.birthDateEstimated !== undefined &&
              next.birthDateEstimated !== current.birthDateEstimated),
        );
        if (changed.length === 0) return chartView(tx, current);
        const [row] = await tx
          .update(patient)
          .set({
            ...next,
            updatedBy: scope.userId,
            updatedAt: nextStamp(this.clock.now(), current.updatedAt),
          })
          .where(eq(patient.id, id))
          .returning();
        if (!row) throw new NotFoundException();
        await audit(
          tx,
          scope,
          'patient.edited',
          id,
          requestId,
          Object.fromEntries(changed.map((key) => [key, true])),
        );
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

/** One row in the clinic: actor, chart, request; `data` only the changed keys of an edit. */
async function audit(
  tx: Tx,
  scope: RequestScope,
  event: AuditEventName,
  targetId: string,
  requestId: string,
  data: Record<string, boolean> = {},
): Promise<void> {
  await tx.insert(auditEvent).values({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    targetId,
    event,
    requestId,
    data,
  });
}
