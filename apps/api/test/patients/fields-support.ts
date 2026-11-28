// Helpers for the A-03-05 custom field tests: a definition body, the calls of the field routes, a
// fresh sign-in after the clock moved (sessions end on the way to day 31) and the audit rows.
import { auditEvent } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { and, eq, like } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { put } from '../entitlements/support.ts';
import { PASSWORD, sessionCookie, signIn } from '../identity/support.ts';
import { totpAt } from '../identity/totp.ts';
import type { TestApp } from '../support.ts';
import { type Clinic, get, patch, post, type TeamWorld } from '../team/support.ts';

export interface FieldOption {
  id: string;
  label: string;
  archived: boolean;
  order: number;
}

export interface FieldDefinition {
  key: string;
  label: string;
  labelEn: string | null;
  type: string;
  required: boolean;
  validation: {
    minLength: number | null;
    maxLength: number | null;
    min: number | null;
    max: number | null;
    pattern: { preset: string; expression: string | null } | null;
  };
  default: unknown;
  options: FieldOption[];
  viewRoles: string[];
  editRoles: string[];
  section: string;
  order: number;
  sensitive: boolean;
  searchable: boolean;
  print: boolean;
  state: 'active' | 'archived';
  archivedAt: string | null;
  purgeAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Definitions {
  fields: FieldDefinition[];
  limits: { used: number; max: number; searchableUsed: number; searchableMax: number };
  listUpdatedAt: string | null;
}

export interface FormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  default: unknown;
  options: { id: string; label: string }[];
  section: string;
  order: number;
  editable: boolean;
  sensitive: boolean;
}

let made = 0;

/** A text field body with a fresh label (labels are unique among active fields). */
export function textField(extra: Record<string, unknown> = {}): Record<string, unknown> {
  made += 1;
  return {
    label: `حقل إداري ${String(made)}`,
    type: 'text',
    section: 'معلومات إدارية',
    viewRoles: ['owner', 'doctor', 'receptionist', 'assistant', 'accountant'],
    editRoles: ['owner', 'receptionist'],
    ...extra,
  };
}

export function createField(app: TestApp, cookie: string, body: Record<string, unknown>) {
  return post(app, '/patients/fields', body, cookie);
}

/** Creates a field and returns it (201 expected). */
export async function created(
  app: TestApp,
  cookie: string,
  extra: Record<string, unknown> = {},
): Promise<FieldDefinition> {
  const res = await createField(app, cookie, textField(extra));
  if (res.statusCode !== 201) throw new Error(`field: ${String(res.statusCode)} ${res.body}`);
  return res.json<FieldDefinition>();
}

export function editField(
  app: TestApp,
  cookie: string,
  key: string,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return patch(app, `/patients/fields/${key}`, body, cookie);
}

export function orderFields(app: TestApp, cookie: string, body: Record<string, unknown>) {
  return put(app, '/patients/fields/order', body, cookie);
}

export function archiveField(app: TestApp, cookie: string, key: string) {
  return post(app, `/patients/fields/${key}/archive`, undefined, cookie);
}

export function restoreField(app: TestApp, cookie: string, key: string) {
  return post(app, `/patients/fields/${key}/restore`, undefined, cookie);
}

export async function definitions(app: TestApp, cookie: string): Promise<Definitions> {
  const res = await get(app, '/patients/fields/definitions', cookie);
  if (res.statusCode !== 200) throw new Error(`definitions: ${String(res.statusCode)} ${res.body}`);
  return res.json<Definitions>();
}

export async function formFields(app: TestApp, cookie: string): Promise<FormField[]> {
  const res = await get(app, '/patients/fields', cookie);
  if (res.statusCode !== 200) throw new Error(`form fields: ${String(res.statusCode)} ${res.body}`);
  return res.json<{ fields: FormField[] }>().fields;
}

/** The validation paths of a 400. */
export function pathsOf(res: LightMyRequestResponse): string[] {
  return (
    res.json<{ error?: { details?: { path: string }[] } }>().error?.details?.map((d) => d.path) ??
    []
  );
}

/** The owner signs in again with password and TOTP (after the clock moved past the session). */
export async function ownerAgain(world: TeamWorld, clinic: Clinic): Promise<string> {
  const pending = sessionCookie(await signIn(world.app, clinic.ownerPhone, PASSWORD));
  const passed = await post(
    world.app,
    '/auth/mfa/challenge',
    { method: 'totp', code: totpAt(clinic.owner.manualKey, world.clock.now()) },
    pending,
  );
  if (passed.statusCode !== 200) throw new Error(`challenge: ${String(passed.statusCode)}`);
  return sessionCookie(passed);
}

/** The clinic's `patient_field.*` audit rows, oldest first. */
export function fieldAudit(clinic: Clinic) {
  return superuserDb(workerDatabaseName())
    .select()
    .from(auditEvent)
    .where(and(eq(auditEvent.tenantId, clinic.clinicId), like(auditEvent.event, 'patient_field.%')))
    .orderBy(auditEvent.at);
}

export const DAY_MS = 24 * 60 * 60 * 1000;
