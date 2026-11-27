// Read-only support access (A-02 criteria 11–14, 26; ADR-0050; slice A-02-05). The super admin opens
// a reasoned, time-boxed grant on one clinic and reads clinic web as its owner through a support
// session opened by a single-use hand-off; every owner sees it and can end it. Reasons are answered
// to the people allowed to read them and never appear in logs, spans, errors or audit rows.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope, SupportEndedBy } from './errors.ts';
import { SessionView } from './identity.ts';

/** The durations a grant may have, in minutes (criterion 11). */
export const SUPPORT_GRANT_MINUTES = [30, 60, 120, 240] as const;

/** One grant, as the super admin's log and the owner's «سجل دخول الدعم» show it. */
export const SupportGrantView = z
  .object({
    id: z.uuid(),
    adminName: z.string(),
    reason: z.string(),
    startedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    /** Null while open; for an expired grant, its expiry. */
    endedAt: z.iso.datetime().nullable(),
    /** Null while open. */
    endedBy: SupportEndedBy.nullable(),
    /** The super admin's or the owner's name; null while open or at its expiry. */
    endedByName: z.string().nullable(),
  })
  .meta({ id: 'SupportGrantView' });
export type SupportGrantView = z.infer<typeof SupportGrantView>;

/** A clinic's support access for the super admin (contract rows `sup`, `supOpen`, `supEnded`). */
export const PlatformSupportGrants = z
  .object({
    /** The server's time («متبقٍّ n دقيقة» from `expiresAt − now`). */
    now: z.iso.datetime(),
    /** This super admin's open grant, or null (then the form). */
    mine: SupportGrantView.nullable(),
    /** Every grant on the clinic, newest first. */
    grants: z.array(SupportGrantView),
  })
  .meta({ id: 'PlatformSupportGrants' });
export type PlatformSupportGrants = z.infer<typeof PlatformSupportGrants>;

export const OpenSupportGrantRequest = z
  .object({
    /** 10–500 characters after trimming (400 `validation_failed` at `body.reason`). */
    reason: z.string().trim().min(10).max(500),
    /** 30, 60, 120 or 240. */
    minutes: z.int().refine((m) => (SUPPORT_GRANT_MINUTES as readonly number[]).includes(m), {
      message: 'minutes must be 30, 60, 120 or 240',
    }),
  })
  .meta({ id: 'OpenSupportGrantRequest' });
export type OpenSupportGrantRequest = z.infer<typeof OpenSupportGrantRequest>;

/** Where the new tab opens: clinic web with a single-use, 2-minute hand-off in the fragment. */
export const SupportHandoff = z.object({ handoffUrl: z.string() }).meta({ id: 'SupportHandoff' });
export type SupportHandoff = z.infer<typeof SupportHandoff>;

export const OpenedSupportGrant = z
  .object({ grant: SupportGrantView, handoffUrl: z.string() })
  .meta({ id: 'OpenedSupportGrant' });
export type OpenedSupportGrant = z.infer<typeof OpenedSupportGrant>;

const SupportClinicParams = z.object({ id: z.uuid() }).meta({ id: 'SupportClinicParams' });
const SupportGrantParams = z.object({ id: z.uuid() }).meta({ id: 'SupportGrantParams' });

/** The owner's banner: an open grant on the clinic (criteria 13, 26). */
export const SupportBannerGrant = z
  .object({
    id: z.uuid(),
    adminName: z.string(),
    reason: z.string(),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'SupportBannerGrant' });

/** The clinic's support access for its owners: the banner and «سجل دخول الدعم». */
export const ClinicSupportGrants = z
  .object({
    now: z.iso.datetime(),
    /** Open grants (one per super admin): the warning banner above every page. */
    open: z.array(SupportBannerGrant),
    /** Every grant, newest first (empty → EmptyState). */
    grants: z.array(SupportGrantView),
  })
  .meta({ id: 'ClinicSupportGrants' });
export type ClinicSupportGrants = z.infer<typeof ClinicSupportGrants>;

/** 43 base64url characters (256 bits), from the hand-off URL's fragment. */
export const SupportHandoffRequest = z
  .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
  .meta({ id: 'SupportHandoffRequest' });
export type SupportHandoffRequest = z.infer<typeof SupportHandoffRequest>;

export const platformSupportGrants = defineContract({
  operationId: 'platformSupportGrants',
  method: 'GET',
  path: '/platform/clinics/:id/support-grants',
  summary: 'A clinic’s support grants: this super admin’s open one and the log',
  request: { params: SupportClinicParams },
  responses: { 200: PlatformSupportGrants, 404: ErrorEnvelope },
});

export const platformOpenSupportGrant = defineContract({
  operationId: 'platformOpenSupportGrant',
  method: 'POST',
  path: '/platform/clinics/:id/support-grants',
  summary: 'Open read-only support access to a clinic; answers the hand-off URL',
  // 404: no such clinic; 409 `support_active`: this super admin has an open grant on it.
  request: { params: SupportClinicParams, body: OpenSupportGrantRequest },
  responses: {
    201: OpenedSupportGrant,
    400: ErrorEnvelope,
    404: ErrorEnvelope,
    409: ErrorEnvelope,
  },
});

export const platformSupportHandoff = defineContract({
  operationId: 'platformSupportHandoff',
  method: 'POST',
  path: '/platform/support-grants/:id/handoff',
  summary: 'A new single-use hand-off for this super admin’s open grant («فتح عيادة الويب»)',
  // 404: no grant of this super admin; 409 `support_ended`: it ended or expired.
  request: { params: SupportGrantParams },
  responses: { 200: SupportHandoff, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const platformEndSupportGrant = defineContract({
  operationId: 'platformEndSupportGrant',
  method: 'POST',
  path: '/platform/support-grants/:id/end',
  summary: 'End this super admin’s open grant',
  // 404: no grant of this super admin; 409 `support_ended`: it already ended or expired.
  request: { params: SupportGrantParams },
  responses: { 200: SupportGrantView, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const clinicSupportGrants = defineContract({
  operationId: 'clinicSupportGrants',
  method: 'GET',
  path: '/clinic/support-grants',
  summary: 'The clinic’s open support grants (banner) and every grant (log)',
  responses: { 200: ClinicSupportGrants },
});

export const clinicEndSupportGrant = defineContract({
  operationId: 'clinicEndSupportGrant',
  method: 'POST',
  path: '/clinic/support-grants/:id/end',
  summary: 'An owner ends a super admin’s support access to the clinic',
  // 404: no such grant in this clinic; 409 `support_ended`: it already ended or expired.
  request: { params: SupportGrantParams },
  responses: { 200: SupportGrantView, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

/** Public: the hand-off token is the credential. */
export const authSupportSession = defineContract({
  operationId: 'authSupportSession',
  method: 'POST',
  path: '/auth/support/session',
  summary: 'Exchange a support hand-off for a support session; sets the support cookie',
  public: true,
  // 404 `link_invalid`: one answer for an unknown, used or expired hand-off or an ended grant.
  request: { body: SupportHandoffRequest },
  responses: { 200: SessionView, 404: ErrorEnvelope },
});

export const authEndSupport = defineContract({
  operationId: 'authEndSupport',
  method: 'POST',
  path: '/auth/support/end',
  summary: 'End the support grant of this support session (the one write it may make)',
  // 403 `forbidden`: not a support session; 401 `session_expired`: it already ended.
  responses: { 204: null },
});
