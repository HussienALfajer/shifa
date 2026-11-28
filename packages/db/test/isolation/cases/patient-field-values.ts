// Isolation case of the A-03-06 custom field values. `patient_field_value` holds one chart's value
// of one field (personal data) and its search key; shifa_app reads, writes, updates and deletes
// them in its own clinic (a cleared value is deleted, a purged field's values too). The same
// chart, field ids and search keys in both clinics: a search by `(field_id, search_key)` must not
// reach the other clinic's rows.
import { and, eq } from 'drizzle-orm';
import { patient, patientField, patientFieldValue } from '../../../src/index.ts';
import { fixtureId } from '../../../test-harness/index.ts';
import { defineIsolationCase, type PrepareContext } from '../define.ts';

const ACTOR = fixtureId('isolation value actor');
const CHART = fixtureId('isolation value chart');
/** Field ids are global keys: one per clinic. */
const fieldOf = (tenantId: string, n: number) =>
  fixtureId(`isolation value field ${tenantId} ${String(n)}`);
const RULES = {
  validation: { minLength: null, maxLength: null, min: null, max: null, pattern: null },
  default: null,
};

/** A chart and two text fields in each clinic, written before the seed. */
async function prepareChartAndFields(ctx: PrepareContext): Promise<void> {
  for (const tenantId of ctx.tenants) {
    await ctx.inTenant(tenantId, async (tx) => {
      await tx.insert(patient).values({
        tenantId,
        id: CHART,
        fileNumber: 1,
        givenName: 'ريم',
        contactPhone: '+963930012345',
        sex: 'female',
        birthDate: '1990-03-12',
        createHash: 'b'.repeat(64),
        createdBy: ACTOR,
        updatedBy: ACTOR,
      });
      await tx.insert(patientField).values(
        [0, 1].map((n) => ({
          tenantId,
          id: fieldOf(tenantId, n),
          number: n + 1,
          key: `cf_${String(n + 1)}`,
          label: `حقل ${String(n + 1)}`,
          type: 'text' as const,
          rules: RULES,
          section: 'معلومات إدارية',
          position: n,
          viewRoles: ['owner', 'receptionist'],
          editRoles: ['owner'],
          searchable: n === 0,
          createdBy: ACTOR,
          updatedBy: ACTOR,
        })),
      );
    });
  }
}

export const patientFieldValueCase = defineIsolationCase({
  table: 'patient_field_value',
  prepare: prepareChartAndFields,
  seed: async (tx, tenantId) => {
    await tx.insert(patientFieldValue).values([
      {
        tenantId,
        patientId: CHART,
        fieldId: fieldOf(tenantId, 0),
        value: 'بطاقة 7',
        searchKey: 'بطاقه 7',
        updatedBy: ACTOR,
      },
      {
        tenantId,
        patientId: CHART,
        fieldId: fieldOf(tenantId, 1),
        value: 'قيمة',
        searchKey: 'قيمه',
        updatedBy: ACTOR,
      },
    ]);
  },
  paths: {
    'a chart’s values (summary, edit, replay)': (tx) =>
      tx.select().from(patientFieldValue).where(eq(patientFieldValue.patientId, CHART)),
    'search by key (the same key in both clinics)': (tx) =>
      tx
        .select()
        .from(patientFieldValue)
        .where(and(eq(patientFieldValue.searchKey, 'بطاقه 7'))),
    'every value (chart counts)': (tx) => tx.select().from(patientFieldValue),
  },
});
