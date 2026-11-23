// The super-admin API (A-01a criteria 2, 3, 13): clinics, their status and end date, and owner
// support actions. Super admins see a clinic's own fields and its owner card, never clinic data.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';
import { SetupLinkPurpose } from './onboarding.ts';

export const ClinicType = z
  .enum(['solo', 'multi_doctor', 'multi_branch'])
  .meta({ id: 'ClinicType' });
export const ClinicStatus = z.enum(['trial', 'active', 'suspended']).meta({ id: 'ClinicStatus' });
export const MembershipStatus = z
  .enum(['pending', 'active', 'deactivated'])
  .meta({ id: 'MembershipStatus' });

/** A name as typed: 1 to 200 characters, not only spaces. */
const Name = z.string().max(200).regex(/\S/);

export const CreateClinicRequest = z
  .object({
    name: Name,
    type: ClinicType,
    status: ClinicStatus,
    /** YYYY-MM-DD; no automatic effect in A-01. */
    subscriptionEnd: z.iso.date().nullable().optional(),
    ownerName: Name,
    /** As typed; normalised to E.164 by the server (400 on body.ownerPhone when invalid). */
    ownerPhone: z.string().min(1).max(32),
  })
  .meta({ id: 'CreateClinicRequest' });
export type CreateClinicRequest = z.infer<typeof CreateClinicRequest>;

export const UpdateClinicRequest = z
  .object({
    status: ClinicStatus.optional(),
    subscriptionEnd: z.iso.date().nullable().optional(),
  })
  .meta({ id: 'UpdateClinicRequest' });
export type UpdateClinicRequest = z.infer<typeof UpdateClinicRequest>;

export const ClinicOwner = z
  .object({ membershipId: z.uuid(), name: z.string(), status: MembershipStatus })
  .meta({ id: 'ClinicOwner' });

export const ClinicSummary = z
  .object({
    id: z.uuid(),
    name: z.string(),
    type: ClinicType,
    status: ClinicStatus,
    subscriptionEnd: z.iso.date().nullable(),
    ownerName: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'ClinicSummary' });
export type ClinicSummary = z.infer<typeof ClinicSummary>;

export const ClinicDetail = ClinicSummary.extend({ owner: ClinicOwner.nullable() }).meta({
  id: 'ClinicDetail',
});
export type ClinicDetail = z.infer<typeof ClinicDetail>;

export const ClinicList = z.object({ clinics: z.array(ClinicSummary) }).meta({ id: 'ClinicList' });
export type ClinicList = z.infer<typeof ClinicList>;

export const ClinicListQuery = z
  .object({ search: z.string().max(200).optional() })
  .meta({ id: 'ClinicListQuery' });

export const ClinicIdParams = z.object({ id: z.uuid() }).meta({ id: 'ClinicIdParams' });

/** A setup link, shown once: copy it or share it through WhatsApp (link text only). */
export const SetupLinkIssued = z
  .object({
    url: z.string(),
    /** `https://wa.me/?text=<url>`: no phone, no other text. */
    whatsappUrl: z.string(),
    purpose: SetupLinkPurpose,
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'SetupLinkIssued' });
export type SetupLinkIssued = z.infer<typeof SetupLinkIssued>;

export const ClinicCreated = z
  .object({ clinic: ClinicDetail, ownerLink: SetupLinkIssued })
  .meta({ id: 'ClinicCreated' });
export type ClinicCreated = z.infer<typeof ClinicCreated>;

export const platformClinics = defineContract({
  operationId: 'platformClinics',
  method: 'GET',
  path: '/platform/clinics',
  summary: 'Clinics, newest first; search by name',
  request: { query: ClinicListQuery },
  responses: { 200: ClinicList },
});

export const platformCreateClinic = defineContract({
  operationId: 'platformCreateClinic',
  method: 'POST',
  path: '/platform/clinics',
  summary: 'Create a clinic and its owner; returns the owner’s setup link once',
  request: { body: CreateClinicRequest },
  responses: { 201: ClinicCreated },
});

export const platformClinic = defineContract({
  operationId: 'platformClinic',
  method: 'GET',
  path: '/platform/clinics/:id',
  summary: 'A clinic and its owner card',
  request: { params: ClinicIdParams },
  responses: { 200: ClinicDetail, 404: ErrorEnvelope },
});

export const platformUpdateClinic = defineContract({
  operationId: 'platformUpdateClinic',
  method: 'PATCH',
  path: '/platform/clinics/:id',
  summary: 'Change a clinic’s status or subscription end date',
  request: { params: ClinicIdParams, body: UpdateClinicRequest },
  responses: { 200: ClinicDetail, 404: ErrorEnvelope },
});

/** Replaces the owner's earlier link; for a set-up owner it also resets the password. */
export const platformOwnerSetupLink = defineContract({
  operationId: 'platformOwnerSetupLink',
  method: 'POST',
  path: '/platform/clinics/:id/owner/setup-link',
  summary: 'Issue a new setup link to the owner (ends the owner’s sessions)',
  request: { params: ClinicIdParams },
  responses: { 200: SetupLinkIssued, 404: ErrorEnvelope },
});

export const platformOwnerResetMfa = defineContract({
  operationId: 'platformOwnerResetMfa',
  method: 'POST',
  path: '/platform/clinics/:id/owner/reset-mfa',
  summary: 'Reset the owner’s TOTP: enrol again at next sign-in (ends the owner’s sessions)',
  request: { params: ClinicIdParams },
  responses: { 204: null, 404: ErrorEnvelope },
});

export const platformOwnerEndSessions = defineContract({
  operationId: 'platformOwnerEndSessions',
  method: 'POST',
  path: '/platform/clinics/:id/owner/end-sessions',
  summary: 'End every session of the owner',
  request: { params: ClinicIdParams },
  responses: { 204: null, 404: ErrorEnvelope },
});
