// What the active clinic may use (A-02 criteria 4–6; slice A-02-03): every member reads its
// features, limits with use and evaluated flags (clinic web hides what is off and names a full
// limit before sending); the owner reads the «الاشتراك» card. Keys only, never Arabic labels: the
// screens label them through i18n.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';
import { ClinicStatus, ClinicType } from './platform.ts';

const CalendarDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);

export const LimitUse = z
  .object({
    key: z.string(),
    /** The effective limit (plan, add-ons and override). */
    limit: z.number().int(),
    /** Use now; null while the key is not counted (`limits.custom_fields` until A-03). */
    used: z.number().int().nullable(),
  })
  .meta({ id: 'LimitUse' });
export type LimitUse = z.infer<typeof LimitUse>;

export const Capabilities = z
  .object({
    /** Each feature entitlement on or off (A-02 registers none). */
    entitlements: z.record(z.string(), z.boolean()),
    limits: z.array(LimitUse),
    /** Each flag declared in code, evaluated for this clinic. */
    flags: z.record(z.string(), z.boolean()),
  })
  .meta({ id: 'Capabilities' });
export type Capabilities = z.infer<typeof Capabilities>;

export const Subscription = z
  .object({
    plan: ClinicType,
    status: ClinicStatus,
    subscriptionEnd: CalendarDate.nullable(),
    limits: z.array(LimitUse),
    /** The feature keys that are on, in catalogue order. */
    features: z.array(z.string()),
  })
  .meta({ id: 'Subscription' });
export type Subscription = z.infer<typeof Subscription>;

export const clinicCapabilities = defineContract({
  operationId: 'clinicCapabilities',
  method: 'GET',
  path: '/clinic/capabilities',
  summary: 'What the active clinic may use: features, limits with use, evaluated flags',
  responses: { 200: Capabilities },
});

export const clinicSubscription = defineContract({
  operationId: 'clinicSubscription',
  method: 'GET',
  path: '/clinic/subscription',
  summary: 'The clinic’s plan, status, end date, limits with use and enabled features (owner)',
  responses: { 200: Subscription, 403: ErrorEnvelope },
});
