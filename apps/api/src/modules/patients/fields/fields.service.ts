// Custom field definitions (spec A-03 criteria 14–17, 20, 37–39; slice A-03-05; ADR-0008). Every
// write runs in the scope the guard checked, under the clinic's limits lock (ClinicLimits): adds
// against `limits.custom_fields`, the 5 searchable and the label rule are decided one at a time.
// Each write first purges the fields archived 30 days ago or more (criterion 17; the injected
// clock decides), as does every read outside a support session. Audit rows hold the field id, its
// key and an edit's changed keys: never a label.
import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CreatePatientFieldRequest,
  PATIENT_FIELD_RULES,
  type PatientFieldDefinition,
  type PatientFieldDefinitions,
  type PatientFieldOrderRequest,
  type PatientFormFields,
  type UpdatePatientFieldRequest,
} from '@shifa/contracts';
import { type AuditEventName, auditEvent, patientField, type Tx } from '@shifa/db';
import { sql } from 'drizzle-orm';
import { type RequestScope, TenantDb } from '../../../access/index.ts';
import { CLOCK, type Clock } from '../../../platform/clock.ts';
import { RequestValidationError } from '../../../platform/contract/index.ts';
import { ApiError } from '../../../platform/errors.ts';
import { ClinicLimits } from '../../entitlements/index.ts';
import { nextStamp, staleChange } from '../charts.ts';
import {
  changedKeys,
  checkedDraft,
  createDraft,
  editDraft,
  type FieldDraft,
  storedDraft,
} from './field-draft.ts';
import {
  definitionOf,
  definitionViews,
  type FieldRow,
  folded,
  formViews,
  type LoadedField,
  listStamp,
  loadFields,
  lockedField,
  purgeExpired,
} from './field-store.ts';
import { writeOptions, writeOrder } from './field-writes.ts';

const LIMIT_KEY = 'limits.custom_fields';

interface WriteContext {
  tx: Tx;
  scope: RequestScope;
  requestId: string;
  now: Date;
  /** The next save time: after every field's last save, so the list's stamp always moves. */
  at: Date;
}

@Injectable()
export class PatientFieldsService {
  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ClinicLimits) private readonly limits: ClinicLimits,
  ) {}

  /** The member's view (contract row `GET /patients/fields`). */
  form(
    scope: RequestScope,
    roles: readonly string[],
    requestId: string,
  ): Promise<PatientFormFields> {
    return this.tenants.run(scope, async (tx) => {
      const now = this.clock.now();
      if (scope.readOnly !== true) await purgeExpired(tx, scope.tenantId, now, requestId);
      return { fields: formViews(await loadFields(tx, now), roles) };
    });
  }

  /** The owner's view with the limits (contract row "List"). */
  definitions(scope: RequestScope, requestId: string): Promise<PatientFieldDefinitions> {
    return this.tenants.run(scope, async (tx) => {
      const now = this.clock.now();
      if (scope.readOnly !== true) await purgeExpired(tx, scope.tenantId, now, requestId);
      return this.#definitionsIn(tx, scope.tenantId, now);
    });
  }

  /** Criteria 14, 15, 37, 39: a new field; its key `cf_<n>` is the clinic's next number. */
  create(
    scope: RequestScope,
    input: CreatePatientFieldRequest,
    requestId: string,
  ): Promise<PatientFieldDefinition> {
    const { draft, defaultInput } = createDraft(input);
    const ids = draft.options.map(() => randomUUID());
    const checked = checkedDraft(input.type, draft, defaultInput, ids);
    return this.#write(scope, requestId, async (ctx) => {
      const { tx } = ctx;
      const live = await loadFields(tx, ctx.now);
      assertLabelFree(live, checked.label, null);
      if (checked.searchable) assertSearchableRoom(live, null);
      await this.limits.assertRoom(tx, scope.tenantId, LIMIT_KEY);
      const section = placeIn(live, checked.section);
      const { rows } = await tx.execute<{ next: number }>(
        sql`select coalesce(max(number), 0)::integer + 1 as next from patient_field`,
      );
      const number = rows[0]?.next ?? 1;
      const [row] = await tx
        .insert(patientField)
        .values({
          ...rowOf(checked),
          tenantId: scope.tenantId,
          number,
          key: `cf_${String(number)}`,
          type: input.type,
          section: section.title,
          position: section.position,
          createdBy: scope.userId,
          updatedBy: scope.userId,
          createdAt: ctx.at,
          updatedAt: ctx.at,
        })
        .returning();
      if (!row) throw new Error('field not written');
      await writeOptions(tx, scope.tenantId, row.id, [], checked.options, ids, ctx.at);
      await audit(ctx, 'patient_field.created', row, {});
      return definitionOf(tx, row.key, ctx.now);
    });
  }

  /** Criteria 14, 15, 37: every part but the type; choices renamed, moved, archived or added. */
  update(
    scope: RequestScope,
    key: string,
    input: UpdatePatientFieldRequest,
    requestId: string,
  ): Promise<PatientFieldDefinition> {
    if (input.type !== undefined) throw new ApiError(400, 'type_fixed');
    return this.#write(scope, requestId, async (ctx) => {
      const { tx } = ctx;
      const current = await this.#current(tx, key, ctx.now);
      const { row } = current;
      if (row.updatedAt.getTime() !== Date.parse(input.expectedUpdatedAt)) {
        throw ApiError.stale(await staleChange(tx, row));
      }
      const { draft, defaultInput, issues } = editDraft(current, input);
      const ids = draft.options.map((o) => o.id ?? randomUUID());
      const checked = checkedDraft(row.type, draft, defaultInput, ids, issues);
      const live = await loadFields(tx, ctx.now);
      if (row.state === 'active') {
        assertLabelFree(live, checked.label, row.id);
        if (checked.searchable && !row.searchable) assertSearchableRoom(live, row.id);
      }
      const moved = folded(checked.section) !== folded(row.section);
      const section = moved
        ? placeIn(live, checked.section)
        : { title: row.section, position: row.position };
      const after: FieldDraft = {
        ...checked,
        section: section.title,
        options: checked.options.map((o, i) => ({ ...o, id: ids[i] ?? '' })),
      };
      const changed = changedKeys(storedDraft(current), after);
      if (changed.length === 0) return definitionOf(tx, key, ctx.now);
      await tx
        .update(patientField)
        .set({
          ...rowOf(checked),
          section: section.title,
          position: section.position,
          updatedBy: scope.userId,
          updatedAt: ctx.at,
        })
        .where(sql`${patientField.id} = ${row.id}`);
      if (changed.includes('options')) {
        await writeOptions(
          tx,
          scope.tenantId,
          row.id,
          current.options,
          checked.options,
          ids,
          ctx.at,
        );
      }
      await audit(ctx, 'patient_field.edited', row, { changed });
      return definitionOf(tx, key, ctx.now);
    });
  }

  /** Criterion 38: every active field once, in its own section; sections keep their order. */
  order(
    scope: RequestScope,
    input: PatientFieldOrderRequest,
    requestId: string,
  ): Promise<PatientFieldDefinitions> {
    return this.#write(scope, requestId, async (ctx) => {
      const { tx } = ctx;
      const live = await loadFields(tx, ctx.now);
      const stamp = listStamp(live);
      const expected =
        input.expectedUpdatedAt === null ? null : Date.parse(input.expectedUpdatedAt);
      if ((stamp?.updatedAt.getTime() ?? null) !== expected) {
        throw ApiError.stale(
          stamp
            ? await staleChange(tx, stamp)
            : { updatedAt: new Date(0).toISOString(), updatedByName: null },
        );
      }
      const moved = await writeOrder(tx, live, input.sections, scope.userId, ctx.at);
      for (const row of moved)
        await audit(ctx, 'patient_field.edited', row, { changed: ['order'] });
      return this.#definitionsIn(tx, scope.tenantId, ctx.now);
    });
  }

  /** Criterion 17: hidden, no longer required, purged with its values after 30 days. */
  archive(scope: RequestScope, key: string, requestId: string): Promise<PatientFieldDefinition> {
    return this.#write(scope, requestId, async (ctx) => {
      const { row } = await this.#current(ctx.tx, key, ctx.now);
      if (row.state !== 'active') return definitionOf(ctx.tx, key, ctx.now);
      await ctx.tx
        .update(patientField)
        .set({ state: 'archived', archivedAt: ctx.at, updatedBy: scope.userId, updatedAt: ctx.at })
        .where(sql`${patientField.id} = ${row.id}`);
      await audit(ctx, 'patient_field.archived', row, {});
      return definitionOf(ctx.tx, key, ctx.now);
    });
  }

  /** Criterion 17: back within 30 days (404 once purged); its label and search slot must be free. */
  restore(scope: RequestScope, key: string, requestId: string): Promise<PatientFieldDefinition> {
    return this.#write(scope, requestId, async (ctx) => {
      const { row } = await this.#current(ctx.tx, key, ctx.now);
      if (row.state === 'active') return definitionOf(ctx.tx, key, ctx.now);
      const live = await loadFields(ctx.tx, ctx.now);
      assertLabelFree(live, row.label, row.id);
      if (row.searchable) assertSearchableRoom(live, row.id);
      await ctx.tx
        .update(patientField)
        .set({ state: 'active', archivedAt: null, updatedBy: scope.userId, updatedAt: ctx.at })
        .where(sql`${patientField.id} = ${row.id}`);
      await audit(ctx, 'patient_field.restored', row, {});
      return definitionOf(ctx.tx, key, ctx.now);
    });
  }

  async #current(tx: Tx, key: string, now: Date): Promise<LoadedField> {
    const field = await lockedField(tx, key, now);
    if (!field) throw new NotFoundException();
    return field;
  }

  async #definitionsIn(tx: Tx, tenantId: string, now: Date): Promise<PatientFieldDefinitions> {
    const fields = await loadFields(tx, now);
    const stamp = listStamp(fields);
    return {
      fields: definitionViews(fields),
      limits: {
        used: (await this.limits.usage(tx))[LIMIT_KEY] ?? 0,
        max: await this.limits.limitOf(tx, tenantId, LIMIT_KEY),
        searchableUsed: searchableCount(fields, null),
        searchableMax: PATIENT_FIELD_RULES.searchableMax,
      },
      listUpdatedAt: stamp ? stamp.updatedAt.toISOString() : null,
    };
  }

  /** A write under the limits lock, after the purge, with the next save time. */
  #write<T>(
    scope: RequestScope,
    requestId: string,
    work: (ctx: WriteContext) => Promise<T>,
  ): Promise<T> {
    return this.tenants.run(scope, async (tx) => {
      await this.limits.lock(tx);
      const now = this.clock.now();
      await purgeExpired(tx, scope.tenantId, now, requestId);
      const { rows } = await tx.execute<{ last: string | null }>(
        sql`select max(updated_at) as last from patient_field`,
      );
      const last = rows[0]?.last;
      const at = nextStamp(now, last ? new Date(last) : undefined);
      return work({ tx, scope, requestId, now, at });
    });
  }
}

/** The stored columns of a checked draft (not the section, set by its place). */
function rowOf(draft: FieldDraft) {
  return {
    label: draft.label,
    labelEn: draft.labelEn,
    required: draft.required,
    rules: draft.rules,
    viewRoles: draft.viewRoles,
    editRoles: draft.editRoles,
    sensitive: draft.sensitive,
    searchable: draft.searchable,
    print: draft.print,
  };
}

/** The section's title as first typed (folded match) and the place after its last field. */
function placeIn(live: readonly LoadedField[], title: string): { title: string; position: number } {
  const same = live.filter(({ row }) => folded(row.section) === folded(title));
  if (same.length === 0) return { title, position: 0 };
  return {
    title: same[0]?.row.section ?? title,
    position: Math.max(...same.map(({ row }) => row.position)) + 1,
  };
}

/** Criterion 37: an active field's label is unique in the clinic after folding. */
function assertLabelFree(live: readonly LoadedField[], label: string, self: string | null): void {
  const taken = live.some(
    ({ row }) => row.state === 'active' && row.id !== self && folded(row.label) === folded(label),
  );
  if (taken) throw new RequestValidationError([{ path: 'body.label', code: 'custom' }]);
}

function searchableCount(live: readonly LoadedField[], self: string | null): number {
  return live.filter(({ row }) => row.state === 'active' && row.searchable && row.id !== self)
    .length;
}

/** Criterion 15: at most 5 active searchable fields. */
function assertSearchableRoom(live: readonly LoadedField[], self: string | null): void {
  if (searchableCount(live, self) >= PATIENT_FIELD_RULES.searchableMax) {
    throw new ApiError(409, 'searchable_limit');
  }
}

async function audit(
  ctx: WriteContext,
  event: AuditEventName,
  row: FieldRow,
  data: { changed?: string[] },
): Promise<void> {
  await ctx.tx.insert(auditEvent).values({
    tenantId: ctx.scope.tenantId,
    actorId: ctx.scope.userId,
    targetId: row.id,
    event,
    requestId: ctx.requestId,
    data: { key: row.key, ...data },
  });
}
