// Feature flags (A-02 criterion 7, OD-114; slice A-02-03): declared in code, switched by the super
// admin off for all (the kill switch), on for all or on for selected clinics, with a reason.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';

export const FlagMode = z.enum(['off', 'on', 'selected']).meta({ id: 'FlagMode' });
export type FlagMode = z.infer<typeof FlagMode>;

export const FlagClinic = z.object({ id: z.uuid(), name: z.string() }).meta({ id: 'FlagClinic' });

export const FlagView = z
  .object({
    key: z.string(),
    /** For developers (the screens label flags through i18n). */
    description: z.string(),
    /** Its value in code, used while no change was made. */
    defaultValue: z.boolean(),
    /** A flag never changed reports its default as `on` or `off`. */
    mode: FlagMode,
    /** The selection, kept while the flag is on or off for all (ignored then). */
    clinics: z.array(FlagClinic),
    reason: z.string().nullable(),
    /** The super admin who changed it last; null: never changed, or the account is gone. */
    updatedByName: z.string().nullable(),
    updatedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'FlagView' });
export type FlagView = z.infer<typeof FlagView>;

export const FlagList = z.object({ flags: z.array(FlagView) }).meta({ id: 'FlagList' });
export type FlagList = z.infer<typeof FlagList>;

export const FlagParams = z
  .object({
    key: z
      .string()
      .max(64)
      .regex(/^[a-z][a-z_]*(\.[a-z][a-z_]*)+$/),
  })
  .meta({ id: 'FlagParams' });

export const SetFlagRequest = z
  .object({
    mode: FlagMode,
    /**
     * The selected clinics: required and non-empty with `selected`; otherwise optional (absent:
     * the stored selection is kept). Unknown clinics answer 400 on body.clinicIds.
     */
    clinicIds: z.array(z.uuid()).max(500).optional(),
    /** Why (10–500 characters once trimmed); kept on the flag, never in the audit log. */
    reason: z.string().trim().min(10).max(500),
  })
  .meta({ id: 'SetFlagRequest' });
export type SetFlagRequest = z.infer<typeof SetFlagRequest>;

export const platformFlags = defineContract({
  operationId: 'platformFlags',
  method: 'GET',
  path: '/platform/flags',
  summary: 'Every flag declared in code, with its mode, clinics, reason and last change',
  responses: { 200: FlagList },
});

export const platformSetFlag = defineContract({
  operationId: 'platformSetFlag',
  method: 'PUT',
  path: '/platform/flags/:key',
  summary: 'Set a flag off for all, on for all or on for selected clinics',
  // 400 `validation_failed`: body.clinicIds (none with `selected`, or an unknown clinic),
  // body.reason; 404: a flag no longer in code.
  request: { params: FlagParams, body: SetFlagRequest },
  responses: { 200: FlagView, 400: ErrorEnvelope, 404: ErrorEnvelope },
});
