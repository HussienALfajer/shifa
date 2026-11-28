// Isolation cases of the A-03-02 chart tables. `patient` holds a clinic's charts (personal data,
// from the synthetic generator) and `patient_file_counter` its next file number; shifa_app reads
// and writes both in its own clinic and deletes neither (charts are never deleted, spec A-03
// criterion 13), so the runner expects every DELETE refused by privileges.
import { createRandom, generatePatientCharts } from '@shifa/testing';
import { and, eq } from 'drizzle-orm';
import {
  patient,
  patientFileCounter,
  patientNameToken,
  patientTreatingDoctor,
} from '../../../src/index.ts';
import { fixtureId } from '../../../test-harness/index.ts';
import { defineIsolationCase, type PrepareContext } from '../define.ts';
import { parentsOf, prepareBranches, prepareMemberships } from './parents.ts';

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

/** A-03-03: the charts the name tokens belong to, written in each clinic before the seed. */
async function prepareCharts(ctx: PrepareContext): Promise<void> {
  for (const tenantId of ctx.tenants) {
    await ctx.inTenant(tenantId, (tx) =>
      tx.insert(patient).values({
        tenantId,
        id: chartId(0),
        fileNumber: 1,
        givenName: CHARTS[0]?.givenName ?? 'ريم',
        contactPhone: CHARTS[0]?.contactPhone ?? '+963930012345',
        sex: 'female',
        birthDate: '1990-03-12',
        createHash: HASH,
        createdBy: ACTOR,
        updatedBy: ACTOR,
      }),
    );
  }
}

/** Tokens of «ريم» (synthetic); the same token in both clinics, so equality must not leak. */
export const patientNameTokenCase = defineIsolationCase({
  table: 'patient_name_token',
  prepare: prepareCharts,
  // Tokens are rewritten (deleted, then written again), never updated.
  withoutPrivilege: ['update'],
  seed: async (tx, tenantId) => {
    await tx.insert(patientNameToken).values([
      {
        tenantId,
        patientId: chartId(0),
        part: 0,
        word: 0,
        token: 'ري',
        whole: false,
        keyVersion: 2,
      },
      {
        tenantId,
        patientId: chartId(0),
        part: 0,
        word: 0,
        token: 'ريم',
        whole: true,
        keyVersion: 2,
      },
    ]);
  },
  paths: {
    'search by token (equality)': (tx) =>
      tx.select().from(patientNameToken).where(eq(patientNameToken.token, 'ريم')),
    'a chart’s tokens (rewrite, matched parts)': (tx) =>
      tx
        .select()
        .from(patientNameToken)
        .where(eq(patientNameToken.patientId, chartId(0))),
  },
});

/** A-03-04: a chart and a member in each clinic, the same ids in both. */
async function prepareChartsAndMembers(ctx: PrepareContext): Promise<void> {
  await prepareCharts(ctx);
  await prepareMemberships(ctx);
}

/**
 * A-03-04: the treating doctors of a chart (spec A-03 criterion 10). The list is replaced by
 * deleting and adding rows, never by an update.
 */
export const patientTreatingDoctorCase = defineIsolationCase({
  table: 'patient_treating_doctor',
  prepare: prepareChartsAndMembers,
  withoutPrivilege: ['update'],
  seed: async (tx, tenantId) => {
    await tx.insert(patientTreatingDoctor).values({
      tenantId,
      patientId: chartId(0),
      memberId: parentsOf(tenantId).membership,
      addedBy: ACTOR,
    });
  },
  paths: {
    'a chart’s doctors (summary, edit)': (tx) =>
      tx
        .select()
        .from(patientTreatingDoctor)
        .where(eq(patientTreatingDoctor.patientId, chartId(0))),
    'a doctor’s charts (my patients, A-03-07)': (tx) =>
      tx.select().from(patientTreatingDoctor).where(eq(patientTreatingDoctor.addedBy, ACTOR)),
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
