// Isolation cases of the A-03-05 custom field tables. `patient_field` holds a clinic's field
// definitions and `patient_field_option` a choice field's choices; shifa_app reads, adds and
// updates both in its own clinic and deletes neither (a purged field stays as a tombstone, a
// choice is archived), so the runner expects every DELETE refused by privileges. The same ids and
// keys in both clinics: a key is unique within its clinic only.
import { eq } from 'drizzle-orm';
import { patientField, patientFieldOption } from '../../../src/index.ts';
import { fixtureId } from '../../../test-harness/index.ts';
import { defineIsolationCase, type PrepareContext } from '../define.ts';

const ACTOR = fixtureId('isolation field actor');
/** Row ids are global keys: one per clinic (keys and numbers repeat across clinics). */
const fieldId = (tenantId: string, n: number) =>
  fixtureId(`isolation field ${tenantId} ${String(n)}`);
const RULES = {
  validation: { minLength: null, maxLength: null, min: null, max: null, pattern: null },
  default: null,
};

const definition = (tenantId: string, n: number) => ({
  tenantId,
  id: fieldId(tenantId, n),
  number: n + 1,
  key: `cf_${String(n + 1)}`,
  label: `حقل ${String(n + 1)}`,
  type: n === 0 ? ('single_choice' as const) : ('text' as const),
  rules: RULES,
  section: 'معلومات إدارية',
  position: n,
  viewRoles: ['owner', 'receptionist'],
  editRoles: ['owner'],
  createdBy: ACTOR,
  updatedBy: ACTOR,
});

export const patientFieldCase = defineIsolationCase({
  table: 'patient_field',
  withoutPrivilege: ['delete'],
  seed: async (tx, tenantId) => {
    await tx.insert(patientField).values([definition(tenantId, 0), definition(tenantId, 1)]);
  },
  paths: {
    'every definition (owner’s view, member’s view, counts)': (tx) =>
      tx.select().from(patientField),
    'one by key (edit, archive, restore)': (tx) =>
      tx.select().from(patientField).where(eq(patientField.key, 'cf_1')),
    'active ones (form, limits, labels taken)': (tx) =>
      tx.select().from(patientField).where(eq(patientField.state, 'active')),
  },
});

/** The choice field the options belong to, written in each clinic before the seed. */
async function prepareFields(ctx: PrepareContext): Promise<void> {
  for (const tenantId of ctx.tenants) {
    await ctx.inTenant(tenantId, (tx) => tx.insert(patientField).values(definition(tenantId, 0)));
  }
}

export const patientFieldOptionCase = defineIsolationCase({
  table: 'patient_field_option',
  prepare: prepareFields,
  withoutPrivilege: ['delete'],
  seed: async (tx, tenantId) => {
    await tx.insert(patientFieldOption).values([
      { tenantId, fieldId: fieldId(tenantId, 0), label: 'نقدي', position: 0 },
      { tenantId, fieldId: fieldId(tenantId, 0), label: 'تأمين', position: 1 },
    ]);
  },
  paths: {
    'the choices of the fields read (views, edit; the same labels in both clinics)': (tx) =>
      tx.select().from(patientFieldOption).where(eq(patientFieldOption.label, 'نقدي')),
    'every choice (owner’s view)': (tx) => tx.select().from(patientFieldOption),
  },
});
