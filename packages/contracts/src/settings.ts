// The settings cascade (A-02 criteria 8–10, PLT-22 to PLT-24; slice A-02-04). Settings are declared
// in code; each read for an admin screen gives the effective value and where it comes from. The
// super admin locks a clinic's value with a value («قفل بقيمة») or unlocks it, never a plain set
// (criterion 9). The clinic's own route keeps its shape (team.ts: `clinicSettings`).
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';

/**
 * The scope a value came from, nearest wins: platform → plan → specialty pack → organization →
 * branch → practitioner → user; `default` when no scope holds a valid value (the value in code).
 */
export const SettingSource = z
  .enum([
    'default',
    'platform',
    'plan',
    'specialty_pack',
    'organization',
    'branch',
    'practitioner',
    'user',
  ])
  .meta({ id: 'SettingSource' });
export type SettingSource = z.infer<typeof SettingSource>;

/**
 * A setting's value: what its key's schema accepts. Inline, not a component: the Dart generator
 * makes a named primitive union an empty class (as EntitlementValue).
 */
const SettingValue = z.union([
  z.number().min(-1_000_000_000).max(1_000_000_000),
  z.string().max(500),
  z.boolean(),
]);
export type SettingValue = z.infer<typeof SettingValue>;

/** A setting key, e.g. `session.idle_minutes` (at most 36: it goes into the audit row). */
const SettingKeyText = z
  .string()
  .max(36)
  .regex(/^[a-z][a-z_]*(\.[a-z][a-z_]*)+$/);

export const SettingView = z
  .object({
    key: z.string(),
    /** The effective value for the clinic. */
    value: SettingValue,
    /** The scope that won → «موروث من: الإعداد الافتراضي», «من: العيادة», «من: الإدارة». */
    source: SettingSource,
    /** A lock holds the value («مقفل من الإدارة»): nobody below it overrides. */
    locked: z.boolean(),
    /** The scope of the lock, or null when not locked. */
    lockedBy: SettingSource.nullable(),
    /** The super admin may lock this key for the clinic («قفل بقيمة»). */
    lockable: z.boolean(),
    /** The schema's allowed values when it is an enum (the lock dialog's Select); otherwise null. */
    choices: z.array(SettingValue).nullable(),
  })
  .meta({ id: 'SettingView' });
export type SettingView = z.infer<typeof SettingView>;

export const ClinicSettingList = z
  .object({ settings: z.array(SettingView) })
  .meta({ id: 'ClinicSettingList' });
export type ClinicSettingList = z.infer<typeof ClinicSettingList>;

const ClinicSettingsParams = z.object({ id: z.uuid() }).meta({ id: 'ClinicSettingsParams' });

export const ClinicSettingParams = z
  .object({ id: z.uuid(), key: SettingKeyText })
  .meta({ id: 'ClinicSettingParams' });

export const LockSettingRequest = z
  .object({
    /** Validated against the key's schema (400 `validation_failed` on body.value). */
    value: SettingValue,
  })
  .meta({ id: 'LockSettingRequest' });
export type LockSettingRequest = z.infer<typeof LockSettingRequest>;

export const platformClinicSettings = defineContract({
  operationId: 'platformClinicSettings',
  method: 'GET',
  path: '/platform/clinics/:id/settings',
  summary: 'Every setting of a clinic with its effective value, source and lock',
  request: { params: ClinicSettingsParams },
  responses: { 200: ClinicSettingList, 404: ErrorEnvelope },
});

export const platformLockSetting = defineContract({
  operationId: 'platformLockSetting',
  method: 'PUT',
  path: '/platform/clinics/:id/settings/:key/lock',
  summary: 'Set and lock a clinic’s value of one setting («قفل بقيمة»)',
  // 400 `validation_failed`: body.value not valid for the key; 404: no such clinic or key;
  // 409 `setting_not_lockable`: the key cannot be locked for a clinic.
  request: { params: ClinicSettingParams, body: LockSettingRequest },
  responses: { 200: SettingView, 400: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const platformUnlockSetting = defineContract({
  operationId: 'platformUnlockSetting',
  method: 'DELETE',
  path: '/platform/clinics/:id/settings/:key/lock',
  summary: 'Unlock a clinic’s setting; the value is inherited again',
  // 404: no such clinic or key, or the key is not locked for the clinic.
  request: { params: ClinicSettingParams },
  responses: { 200: SettingView, 404: ErrorEnvelope },
});
