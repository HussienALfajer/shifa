// Helpers for the A-03-06 custom field value tests: a field on the summary, the value rows as
// stored, and definition bodies of each type.
import { patientFieldValue } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { eq } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';
import type { TestApp } from '../support.ts';
import { created, type FieldDefinition } from './fields-support.ts';
import type { ChartBody } from './support.ts';

/** A field on the summary (contract row "Summary", `fields[]`). */
export interface ChartField {
  key: string;
  label: string;
  section: string;
  order: number;
  type: string;
  value: unknown;
  sensitive: boolean;
  options: { id: string; label: string; archived: boolean }[];
}

export type ValuedChart = ChartBody & { fields: ChartField[] };

/** The chart of a 200 or 201 answer. */
export function chartIn(res: LightMyRequestResponse, status = 200): ValuedChart {
  expect(res.statusCode, res.body).toBe(status);
  return res.json<ValuedChart>();
}

/** The value of `key` on the summary (undefined: the field is not shown). */
export function valueOf(chart: { fields: ChartField[] }, key: string): unknown {
  return chart.fields.find((f) => f.key === key)?.value;
}

/** The keys of the fields a summary shows. */
export const keysOf = (chart: { fields: ChartField[] }) => chart.fields.map((f) => f.key);

/** The stored value rows of a chart (superuser read). */
export function storedValues(chartId: string) {
  return superuserDb(workerDatabaseName())
    .select()
    .from(patientFieldValue)
    .where(eq(patientFieldValue.patientId, chartId));
}

const EVERYONE = ['owner', 'doctor', 'receptionist', 'assistant', 'accountant'];

/** A field of `type` everyone views and the owner and reception edit. */
export function fieldOf(
  app: TestApp,
  cookie: string,
  type: string,
  extra: Record<string, unknown> = {},
): Promise<FieldDefinition> {
  const choices =
    type === 'single_choice' || type === 'multi_choice'
      ? { options: [{ label: 'نقدي' }, { label: 'تأمين' }, { label: 'منحة' }] }
      : {};
  return created(app, cookie, {
    type,
    viewRoles: EVERYONE,
    editRoles: ['owner', 'receptionist'],
    ...choices,
    ...extra,
  });
}

/** The 403 `field_not_editable` keys of an answer. */
export function refusedKeys(res: LightMyRequestResponse): string[] {
  return res.json<{ error?: { fieldKeys?: string[] } }>().error?.fieldKeys ?? [];
}
