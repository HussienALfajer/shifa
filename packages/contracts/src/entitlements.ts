// Entitlements of a clinic (A-02 criteria 1–3, 20; slice A-02-02): its plan is its type, each
// catalogue key resolves from the plan, add-ons and the super admin's override. Super-admin routes
// only; the clinic's own view of its limits comes with A-02-03.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';
import { ClinicType } from './platform.ts';

/** A calendar date, `YYYY-MM-DD` (same rule as the clinic's subscription end). */
const CalendarDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);

export const EntitlementKind = z.enum(['limit', 'feature']).meta({ id: 'EntitlementKind' });
export type EntitlementKind = z.infer<typeof EntitlementKind>;

/** A limit's number (whole, ≥ 0) or a feature's on/off. */
export const EntitlementValue = z
  .union([z.number().int().min(0).max(100_000), z.boolean()])
  .meta({ id: 'EntitlementValue' });
export type EntitlementValue = z.infer<typeof EntitlementValue>;

/** A catalogue key, e.g. `limits.practitioners`. */
const EntitlementKeyText = z
  .string()
  .max(64)
  .regex(/^[a-z][a-z_]*(\.[a-z][a-z_]*)+$/);

export const EntitlementOverride = z
  .object({
    value: EntitlementValue,
    reason: z.string(),
    /** Last day it counts (to the end of that Damascus day); null: no expiry. */
    expiresAt: CalendarDate.nullable(),
    /** Its expiry has passed: shown struck through, no longer counted. */
    expired: z.boolean(),
    /** The super admin who set it; null when the account is gone. */
    setByName: z.string().nullable(),
    setAt: z.iso.datetime(),
  })
  .meta({ id: 'EntitlementOverride' });
export type EntitlementOverride = z.infer<typeof EntitlementOverride>;

export const EntitlementItem = z
  .object({
    key: z.string(),
    kind: EntitlementKind,
    /** The plan's value alone (add-ons and the override count in `effective`). */
    planValue: EntitlementValue,
    override: EntitlementOverride.nullable(),
    /** What the clinic gets now (PLT-21 resolution). */
    effective: EntitlementValue,
  })
  .meta({ id: 'EntitlementItem' });
export type EntitlementItem = z.infer<typeof EntitlementItem>;

export const ClinicEntitlements = z
  .object({ plan: ClinicType, items: z.array(EntitlementItem) })
  .meta({ id: 'ClinicEntitlements' });
export type ClinicEntitlements = z.infer<typeof ClinicEntitlements>;

export const ClinicEntitlementParams = z
  .object({ id: z.uuid(), key: EntitlementKeyText })
  .meta({ id: 'ClinicEntitlementParams' });

export const SetOverrideRequest = z
  .object({
    /** A whole number ≥ 0 for a limit, a boolean for a feature (400 on body.value otherwise). */
    value: EntitlementValue,
    /** Why (10–500 characters once trimmed); kept on the override, never in the audit log. */
    reason: z.string().trim().min(10).max(500),
    /** `YYYY-MM-DD` after today (Damascus); null or absent: no expiry. */
    expiresAt: CalendarDate.nullable().optional(),
  })
  .meta({ id: 'SetOverrideRequest' });
export type SetOverrideRequest = z.infer<typeof SetOverrideRequest>;

export const OverrideEventKind = z
  .enum(['set', 'changed', 'removed', 'expired', 'type_changed'])
  .meta({ id: 'OverrideEventKind' });

/** A key's value at one point of its history: an override (value, expiry) or a plan value. */
export const OverrideState = z
  .object({ value: EntitlementValue, expiresAt: CalendarDate.nullable() })
  .meta({ id: 'OverrideState' });

export const OverrideEvent = z
  .object({
    kind: OverrideEventKind,
    at: z.iso.datetime(),
    /** The super admin; null for `expired` (nobody acted) or an account that is gone. */
    byName: z.string().nullable(),
    before: OverrideState.nullable(),
    after: OverrideState.nullable(),
    reason: z.string().nullable(),
  })
  .meta({ id: 'OverrideEvent' });
export type OverrideEvent = z.infer<typeof OverrideEvent>;

export const OverrideHistory = z
  .object({ events: z.array(OverrideEvent) })
  .meta({ id: 'OverrideHistory' });
export type OverrideHistory = z.infer<typeof OverrideHistory>;

export const TypePreviewQuery = z.object({ type: ClinicType }).meta({ id: 'TypePreviewQuery' });

export const TypePreviewLimit = z
  .object({
    key: z.string(),
    /** Effective now. */
    current: z.number(),
    /** Effective after the change: the new plan's value, or the override that stays. */
    next: z.number(),
    used: z.number(),
    /** `next < used`: nothing is removed, new ones are refused. */
    over: z.boolean(),
  })
  .meta({ id: 'TypePreviewLimit' });

export const TypePreview = z
  .object({ type: ClinicType, limits: z.array(TypePreviewLimit) })
  .meta({ id: 'TypePreview' });
export type TypePreview = z.infer<typeof TypePreview>;

const ClinicIdOnly = z.object({ id: z.uuid() }).meta({ id: 'ClinicEntitlementsParams' });

export const platformClinicEntitlements = defineContract({
  operationId: 'platformClinicEntitlements',
  method: 'GET',
  path: '/platform/clinics/:id/entitlements',
  summary: 'A clinic’s plan and every catalogue key with plan value, override and effective value',
  request: { params: ClinicIdOnly },
  responses: { 200: ClinicEntitlements, 404: ErrorEnvelope },
});

export const platformSetOverride = defineContract({
  operationId: 'platformSetOverride',
  method: 'PUT',
  path: '/platform/clinics/:id/overrides/:key',
  summary: 'Set or change a clinic’s override of one key (reason required, optional expiry)',
  // 400 `validation_failed`: body.value (wrong type for the key), body.reason, body.expiresAt
  // (today or past); 404: no such clinic, or a key outside the catalogue.
  request: { params: ClinicEntitlementParams, body: SetOverrideRequest },
  responses: { 200: EntitlementItem, 400: ErrorEnvelope, 404: ErrorEnvelope },
});

export const platformRemoveOverride = defineContract({
  operationId: 'platformRemoveOverride',
  method: 'DELETE',
  path: '/platform/clinics/:id/overrides/:key',
  summary: 'Remove a clinic’s override of one key',
  request: { params: ClinicEntitlementParams },
  responses: { 200: EntitlementItem, 404: ErrorEnvelope },
});

export const platformOverrideHistory = defineContract({
  operationId: 'platformOverrideHistory',
  method: 'GET',
  path: '/platform/clinics/:id/overrides/:key/history',
  summary: 'Every change of one key for a clinic, newest first',
  request: { params: ClinicEntitlementParams },
  responses: { 200: OverrideHistory, 404: ErrorEnvelope },
});

export const platformTypePreview = defineContract({
  operationId: 'platformTypePreview',
  method: 'GET',
  path: '/platform/clinics/:id/type-preview',
  summary: 'The limits a clinic would have under another type, against its current use',
  // 400 `validation_failed` on query.type when it is the clinic's current type.
  request: { params: ClinicIdOnly, query: TypePreviewQuery },
  responses: { 200: TypePreview, 400: ErrorEnvelope, 404: ErrorEnvelope },
});
