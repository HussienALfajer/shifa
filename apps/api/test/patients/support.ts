// Helpers for the A-03-02 chart tests: a world of clinics (team helpers), a chart body from the
// synthetic generator (names from its lists, synthetic phones), and the calls of the chart API.
import { randomUUID } from 'node:crypto';
import { auditEvent } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { createRandom, generatePatientCharts } from '@shifa/testing';
import { and, eq, like } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { type Clinic, get, patch, post, type TeamWorld } from '../team/support.ts';

export interface ChartBody {
  id: string;
  displayName: string;
  fileNumber: number;
  sex: 'male' | 'female';
  birthDate: string;
  birthDateEstimated: boolean;
  contactPhone: string;
  state: 'active' | 'archived' | 'merged';
  givenName: string;
  fatherName: string | null;
  familyName: string | null;
  motherName: string | null;
  secondPhone: string | null;
  previousFileNumber: string | null;
  registeredBranch: { id: string; name: string } | null;
  createdAt: string;
  createdByName: string | null;
  updatedAt: string;
  updatedByName: string | null;
  archivedAt: string | null;
  archivedByName: string | null;
  mergedInto: { id: string; fileNumber: number } | null;
}

let drawn = 0;

/** A new registration body: a fresh client id, a synthetic name and the given phone. */
export function chartInput(phone: string, extra: Record<string, unknown> = {}) {
  drawn += 1;
  const [chart] = generatePatientCharts({
    random: createRandom(2026_11_27).fork(String(drawn)),
    count: 1,
    today: '2026-11-27',
  });
  if (!chart) throw new Error('no synthetic chart');
  return {
    id: randomUUID(),
    givenName: chart.givenName,
    fatherName: chart.fatherName,
    familyName: chart.familyName,
    contactPhone: phone,
    sex: chart.sex,
    birthDate: chart.birthDate,
    ...extra,
  };
}

export function register(world: TeamWorld, cookie: string, body: Record<string, unknown>) {
  return post(world.app, '/patients', body, cookie);
}

/** Registers a chart as `cookie` and returns it (201 expected). */
export async function registered(
  world: TeamWorld,
  cookie: string,
  extra: Record<string, unknown> = {},
): Promise<ChartBody> {
  const res = await register(world, cookie, chartInput(world.phone(), extra));
  if (res.statusCode !== 201) throw new Error(`register: ${String(res.statusCode)} ${res.body}`);
  return res.json<ChartBody>();
}

export function chartOf(world: TeamWorld, cookie: string, id: string) {
  return get(world.app, `/patients/${id}`, cookie);
}

export function edit(world: TeamWorld, cookie: string, id: string, body: Record<string, unknown>) {
  return patch(world.app, `/patients/${id}`, body, cookie);
}

export function archive(world: TeamWorld, cookie: string, id: string, expectedUpdatedAt: string) {
  return post(world.app, `/patients/${id}/archive`, { expectedUpdatedAt }, cookie);
}

export function restore(world: TeamWorld, cookie: string, id: string, expectedUpdatedAt: string) {
  return post(world.app, `/patients/${id}/restore`, { expectedUpdatedAt }, cookie);
}

export function countOf(world: TeamWorld, cookie: string) {
  return get(world.app, '/patients/count', cookie);
}

/** The clinic's `patient.*` audit rows, oldest first. */
export function patientAudit(clinic: Clinic) {
  return superuserDb(workerDatabaseName())
    .select()
    .from(auditEvent)
    .where(and(eq(auditEvent.tenantId, clinic.clinicId), like(auditEvent.event, 'patient.%')))
    .orderBy(auditEvent.at);
}

export function codeOf(res: LightMyRequestResponse): string | undefined {
  return res.json<{ error?: { code?: string } }>().error?.code;
}
