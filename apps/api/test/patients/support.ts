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
  /** A-03-04: the relation to the phone's holder, the family on the phone, treating doctors. */
  relation: string | null;
  family: FamilyCard[];
  treatingDoctors: { memberId: string; name: string; active: boolean }[];
}

/** A chart in an answer (`PatientCard`), with its relation in a family list (A-03-04). */
export interface FamilyCard {
  id: string;
  displayName: string;
  fileNumber: number;
  sex: 'male' | 'female';
  birthDate: string;
  birthDateEstimated: boolean;
  contactPhone: string;
  state: 'active' | 'archived' | 'merged';
  relation: string | null;
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

/**
 * Registers a chart as `cookie` and returns it (201 expected). A possible duplicate (A-03-04) is
 * acknowledged and registered anyway: tests that are about duplicates call `register` instead.
 */
export async function registered(
  world: TeamWorld,
  cookie: string,
  extra: Record<string, unknown> = {},
): Promise<ChartBody> {
  const input = chartInput(world.phone(), extra);
  let res = await register(world, cookie, input);
  if (res.statusCode === 409 && codeOf(res) === 'possible_duplicate') {
    const ids = candidatesOf(res).map((c) => c.card?.id ?? '');
    res = await register(world, cookie, { ...input, acknowledgedCandidateIds: ids });
  }
  if (res.statusCode !== 201) throw new Error(`register: ${String(res.statusCode)} ${res.body}`);
  return res.json<ChartBody>();
}

/** One duplicate candidate (A-03-04; contract `POST /patients/duplicates`). */
export interface Candidate {
  visible: boolean;
  fileNumber: number;
  reason: 'same_phone_similar_name' | 'similar_name_near_birth_year';
  /** The chart's card when `visible`; null when hidden by "my patients only" (A-03-07). */
  card: Omit<FamilyCard, 'relation'> | null;
}

/** The candidates of a 409 `possible_duplicate`. */
export function candidatesOf(res: LightMyRequestResponse): Candidate[] {
  return res.json<{ error?: { candidates?: Candidate[] } }>().error?.candidates ?? [];
}

export function duplicates(world: TeamWorld, cookie: string, body: Record<string, unknown>) {
  return post(world.app, '/patients/duplicates', body, cookie);
}

/** The candidates of a duplicate check (200 expected). */
export async function candidates(
  world: TeamWorld,
  cookie: string,
  body: Record<string, unknown>,
): Promise<Candidate[]> {
  const res = await duplicates(world, cookie, body);
  if (res.statusCode !== 200) throw new Error(`duplicates: ${String(res.statusCode)} ${res.body}`);
  return res.json<{ candidates: Candidate[] }>().candidates;
}

export function familyOf(world: TeamWorld, cookie: string, body: Record<string, unknown>) {
  return post(world.app, '/patients/family', body, cookie);
}

export function doctorsOf(world: TeamWorld, cookie: string) {
  return get(world.app, '/patients/doctors', cookie);
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

/** One search result (A-03-03; contract `POST /patients/search`). */
export interface SearchHit {
  id: string;
  displayName: string;
  givenName: string;
  fatherName: string | null;
  familyName: string | null;
  fileNumber: number;
  sex: 'male' | 'female';
  birthDate: string;
  birthDateEstimated: boolean;
  contactPhone: string;
  state: 'active' | 'archived' | 'merged';
  archivedAt: string | null;
  matchedBy: string;
  matchedParts: number[];
  mergedFileNumber: number | null;
  /** A-03-04: charts on the same contact phone, this one included; its relation. */
  familySize: number;
  relation: string | null;
}

export function search(world: TeamWorld, cookie: string, body: Record<string, unknown>) {
  return post(world.app, '/patients/search', body, cookie);
}

/** The results of a search (200 expected). */
export async function found(
  world: TeamWorld,
  cookie: string,
  term: string,
  extra: Record<string, unknown> = {},
): Promise<{ results: SearchHit[]; truncated: boolean }> {
  const res = await search(world, cookie, { term, ...extra });
  if (res.statusCode !== 200) throw new Error(`search: ${String(res.statusCode)} ${res.body}`);
  return res.json<{ results: SearchHit[]; truncated: boolean }>();
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
