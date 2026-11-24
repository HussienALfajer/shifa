// The clinic team (A-01b criteria 2–7), invitations (criterion 2) and the clinic's idle setting
// (A-01a criterion 9). The owner's view of a new member is the same whether or not the phone has
// an account: no link purpose, no account data, the name as the owner typed it (OD-76).
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';
import { SessionRole } from './identity.ts';
import { SetupLinkToken } from './onboarding.ts';
import { MembershipStatus } from './platform.ts';

/** A name as typed: 1 to 200 characters, not only spaces. */
const Name = z.string().max(200).regex(/\S/);

/** A permission key of the catalogue, e.g. `clinical.notes.view`. */
export const PermissionKeyName = z
  .string()
  .max(100)
  .regex(/^[a-z][a-z_]*(\.[a-z][a-z_]*)+$/)
  .meta({ id: 'PermissionKeyName' });

/** A role held tenant-wide (`branchId` null) or in one branch (PLT-45). */
export const RoleScopeInput = z
  .object({ role: SessionRole, branchId: z.uuid().nullable() })
  .meta({ id: 'RoleScopeInput' });
export type RoleScopeInput = z.infer<typeof RoleScopeInput>;

export const MemberRole = z
  .object({ role: SessionRole, branchId: z.uuid().nullable(), branchName: z.string().nullable() })
  .meta({ id: 'MemberRole' });
export type MemberRole = z.infer<typeof MemberRole>;

/** One sensitive key of a member: the role default, what applies, and whether it is switched. */
export const MemberPermission = z
  .object({
    key: PermissionKeyName,
    roleDefault: z.boolean(),
    granted: z.boolean(),
    overridden: z.boolean(),
  })
  .meta({ id: 'MemberPermission' });
export type MemberPermission = z.infer<typeof MemberPermission>;

export const MemberSummary = z
  .object({
    id: z.uuid(),
    name: z.string(),
    /** E.164; members' phones show to the owner only (members.view). */
    phone: z.string(),
    status: MembershipStatus,
    roles: z.array(MemberRole),
    lastActiveAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'MemberSummary' });
export type MemberSummary = z.infer<typeof MemberSummary>;

export const MemberDetail = MemberSummary.extend({
  permissions: z.array(MemberPermission),
  /** The clinic's only active owner: roles and deactivation are refused (`last_owner`). */
  isLastOwner: z.boolean(),
  /** The member's account has TOTP enrolled: the owner may reset it (OD-95), not an owner's. */
  mfaEnrolled: z.boolean(),
}).meta({ id: 'MemberDetail' });
export type MemberDetail = z.infer<typeof MemberDetail>;

export const MemberList = z.object({ members: z.array(MemberSummary) }).meta({ id: 'MemberList' });
export type MemberList = z.infer<typeof MemberList>;

/** A member's link, shown once (copy and WhatsApp share); no purpose, by design (OD-76). */
export const MemberLinkIssued = z
  .object({ url: z.string(), whatsappUrl: z.string(), expiresAt: z.iso.datetime() })
  .meta({ id: 'MemberLinkIssued' });
export type MemberLinkIssued = z.infer<typeof MemberLinkIssued>;

export const AddMemberRequest = z
  .object({
    name: Name,
    /** As typed; normalised to E.164 by the server (400 on body.phone when invalid). */
    phone: z.string().min(1).max(32),
    roles: z.array(RoleScopeInput).min(1).max(20),
  })
  .meta({ id: 'AddMemberRequest' });
export type AddMemberRequest = z.infer<typeof AddMemberRequest>;

export const MemberAdded = z
  .object({ member: MemberDetail, link: MemberLinkIssued })
  .meta({ id: 'MemberAdded' });
export type MemberAdded = z.infer<typeof MemberAdded>;

/** A sensitive key switched on or off; `null` returns it to the role default. */
export const PermissionSwitch = z
  .object({ key: PermissionKeyName, granted: z.boolean().nullable() })
  .meta({ id: 'PermissionSwitch' });

export const UpdateMemberRequest = z
  .object({
    /** The full new list; empty removes every role (the member's sessions here end). */
    roles: z.array(RoleScopeInput).max(20).optional(),
    permissions: z.array(PermissionSwitch).max(50).optional(),
  })
  .meta({ id: 'UpdateMemberRequest' });
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequest>;

export const MemberIdParams = z.object({ id: z.uuid() }).meta({ id: 'MemberIdParams' });

export const InvitationRole = z
  .object({ role: SessionRole, branchName: z.string().nullable() })
  .meta({ id: 'InvitationRole' });

/** What the invitation page shows: the clinic, the name the owner typed, roles and scope. */
export const InvitationView = z
  .object({
    clinicName: z.string(),
    personName: z.string(),
    roles: z.array(InvitationRole),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'InvitationView' });
export type InvitationView = z.infer<typeof InvitationView>;

export const InvitationRequest = z
  .object({ token: SetupLinkToken })
  .meta({ id: 'InvitationRequest' });

/** Minutes of inactivity before automatic sign-out (OD-77). */
export const IdleMinutes = z.literal([15, 30, 60]).meta({ id: 'IdleMinutes' });

export const ClinicSettings = z.object({ idleMinutes: IdleMinutes }).meta({ id: 'ClinicSettings' });
export type ClinicSettings = z.infer<typeof ClinicSettings>;

export const teamMembers = defineContract({
  operationId: 'teamMembers',
  method: 'GET',
  path: '/team/members',
  summary: 'The clinic’s members with roles, scope and status',
  responses: { 200: MemberList },
});

export const teamMember = defineContract({
  operationId: 'teamMember',
  method: 'GET',
  path: '/team/members/:id',
  summary: 'A member with toggles and the role defaults',
  request: { params: MemberIdParams },
  responses: { 200: MemberDetail, 404: ErrorEnvelope },
});

export const teamAddMember = defineContract({
  operationId: 'teamAddMember',
  method: 'POST',
  path: '/team/members',
  summary: 'Add a member with roles; returns their link once',
  request: { body: AddMemberRequest },
  // 409 `phone_in_team`: the phone is already a member of this clinic.
  responses: { 201: MemberAdded, 409: ErrorEnvelope },
});

export const teamUpdateMember = defineContract({
  operationId: 'teamUpdateMember',
  method: 'PATCH',
  path: '/team/members/:id',
  summary: 'Change a member’s roles and sensitive toggles',
  request: { params: MemberIdParams, body: UpdateMemberRequest },
  // 400 `permission_not_sensitive`; 409 `last_owner`.
  responses: { 200: MemberDetail, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const teamDeactivateMember = defineContract({
  operationId: 'teamDeactivateMember',
  method: 'POST',
  path: '/team/members/:id/deactivate',
  summary: 'Deactivate a member; their sessions in this clinic end',
  request: { params: MemberIdParams },
  responses: { 200: MemberDetail, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const teamReactivateMember = defineContract({
  operationId: 'teamReactivateMember',
  method: 'POST',
  path: '/team/members/:id/reactivate',
  summary: 'Reactivate a deactivated member',
  request: { params: MemberIdParams },
  responses: { 200: MemberDetail, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const teamMemberLink = defineContract({
  operationId: 'teamMemberLink',
  method: 'POST',
  path: '/team/members/:id/setup-link',
  summary: 'Issue a new link (staff recovery); ends the member’s sessions',
  request: { params: MemberIdParams },
  // 409 `account_shared`: the account works in another clinic too; no link (OD-86).
  responses: { 200: MemberLinkIssued, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

/**
 * Staff TOTP reset (A-01b criterion 3, OD-95): the member's sessions end; they enrol again at
 * the next sign-in. 409 `owner_mfa_platform` (an owner's goes through the super admin),
 * `mfa_not_enrolled`, `account_shared` (its sessions in this clinic ended first, as OD-86).
 */
export const teamMemberResetMfa = defineContract({
  operationId: 'teamMemberResetMfa',
  method: 'POST',
  path: '/team/members/:id/reset-mfa',
  summary: 'Reset a member’s TOTP; ends the member’s sessions',
  request: { params: MemberIdParams },
  responses: { 200: MemberDetail, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

/** Public. 404 `link_invalid` for anything but a valid invitation. */
export const invitationView = defineContract({
  operationId: 'invitationView',
  method: 'POST',
  path: '/invitations/view',
  summary: 'The clinic, name, roles and scope of an invitation',
  public: true,
  request: { body: InvitationRequest },
  responses: { 200: InvitationView, 404: ErrorEnvelope },
});

export const invitationAccept = defineContract({
  operationId: 'invitationAccept',
  method: 'POST',
  path: '/invitations/accept',
  summary: 'Accept an invitation as the signed-in person it was sent to',
  request: { body: InvitationRequest },
  responses: { 204: null, 404: ErrorEnvelope },
});

export const invitationDecline = defineContract({
  operationId: 'invitationDecline',
  method: 'POST',
  path: '/invitations/decline',
  summary: 'Decline an invitation as the signed-in person it was sent to',
  request: { body: InvitationRequest },
  responses: { 204: null, 404: ErrorEnvelope },
});

export const clinicSettings = defineContract({
  operationId: 'clinicSettings',
  method: 'GET',
  path: '/clinic/settings',
  summary: 'The clinic’s settings (automatic sign-out)',
  responses: { 200: ClinicSettings },
});

export const clinicUpdateSettings = defineContract({
  operationId: 'clinicUpdateSettings',
  method: 'PATCH',
  path: '/clinic/settings',
  summary: 'Change the clinic’s automatic sign-out (15, 30 or 60 minutes)',
  request: { body: ClinicSettings },
  responses: { 200: ClinicSettings },
});
