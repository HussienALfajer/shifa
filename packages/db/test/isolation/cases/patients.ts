// Isolation cases of the A-03-02 chart tables. `patient` holds a clinic's charts (personal data,
// from the synthetic generator) and `patient_file_counter` its next file number; shifa_app reads
// and writes both in its own clinic and deletes neither (charts are never deleted, spec A-03
// criterion 13), so the runner expects every DELETE refused by privileges.
import { createRandom, generatePatientCharts } from '@shifa/testing';
import { and, eq } from 'drizzle-orm';
import { patient, patientFileCounter } from '../../../src/index.ts';
import { fixtureId } from '../../../test-harness/index.ts';
import { defineIsolationCase } from '../define.ts';
import { parentsOf, prepareBranches } from './parents.ts';

const CHARTS = generatePatientCharts({
  random: createRandom(2026_11_27),
  count: 2,
  today: '2026-11-27',
});
const HASH = 'a'.repeat(64);
const ACTOR = fixtureId('isolation chart actor');
/** The same ids in both clinics: a chart id is unique within its clinic only (criterion 3). */
const chartId = (n: number) => fixtureId(`isolation chart ${String(n)}`);

export const patientCase = defineIsolationCase({
  table: 'patient',
  prepare: prepareBranches,
  withoutPrivilege: ['delete'],
  seed: async (tx, tenantId) => {
    await tx.insert(patient).values(
      CHARTS.map((c, i) => ({
        tenantId,
        id: chartId(i),
        fileNumber: i + 1,
        givenName: c.givenName,
        fatherName: c.fatherName,
        familyName: c.familyName,
        contactPhone: c.contactPhone,
        sex: c.sex,
        birthDate: c.birthDate,
        birthDateEstimated: c.birthDateEstimated,
        registeredBranchId: i === 0 ? parentsOf(tenantId).branch : null,
        createHash: HASH,
        createdBy: ACTOR,
        updatedBy: ACTOR,
      })),
    );
  },
  paths: {
    'every chart (count)': (tx) => tx.select().from(patient),
    'one chart by id (read, edit, archive)': (tx) =>
      tx
        .select()
        .from(patient)
        .where(eq(patient.id, chartId(0))),
    'active and archived counts': (tx) =>
      tx.select().from(patient).where(eq(patient.state, 'active')),
    'previous number clash': (tx) =>
      tx
        .select()
        .from(patient)
        .where(and(eq(patient.fileNumber, 1), eq(patient.state, 'active'))),
  },
});

export const patientFileCounterCase = defineIsolationCase({
  table: 'patient_file_counter',
  withoutPrivilege: ['delete'],
  seed: async (tx, tenantId) => {
    await tx.insert(patientFileCounter).values({ tenantId, next: 3 });
  },
  paths: {
    'the clinic’s counter': (tx) => tx.select().from(patientFileCounter),
  },
});
