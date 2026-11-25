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
    /**
     * The member's latest unused, unreplaced link, past or future (a past date reads «انتهى
     * الرابط»); null when no link is open (A-01-12).
     */
    linkExpiresAt: z.iso.datetime().nullable(),
    /** The row of the signed-in person («أنت»; A-01-12). */
    isSelf: z.boolean(),
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

/** A sensitive key set on or off when adding a member (OD-102). */
export const PermissionSetting = z
  .object({ key: PermissionKeyName, granted: z.boolean() })
  .meta({ id: 'PermissionSetting' });

/** As typed; normalised to E.164 by the server (400 on body.phone when invalid). */
const PhoneInput = z.string().min(1).max(32);

export const AddMemberRequest = z
  .object({
    name: Name,
    phone: PhoneInput,
    roles: z.array(RoleScopeInput).min(1).max(20),
    /**
     * Sensitive toggles (OD-102); only a switch that differs from the default of `roles` is
     * stored, so a later role change still moves the untouched keys.
     */
    permissions: z.array(PermissionSetting).max(50).optional(),
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
    /** Any member's name, as typed (OD-103); audited without the name. */
    name: Name.optional(),
    /** The full new list; empty removes every role (the member's sessions here end). */
    roles: z.array(RoleScopeInput).max(20).optional(),
    permissions: z.array(PermissionSwitch).max(50).optional(),
  })
  .meta({ id: 'UpdateMemberRequest' });
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequest>;

export const MemberIdParams = z.object({ id: z.uuid() }).meta({ id: 'MemberIdParams' });

/** A pending member's new phone (OD-103). */
export const MemberPhoneRequest = z
  .object({ phone: PhoneInput })
  .meta({ id: 'MemberPhoneRequest' });
export type MemberPhoneRequest = z.infer<typeof MemberPhoneRequest>;

/** A sensitive key with the roles that grant it by default (OD-102). */
export const PermissionDefault = z
  .object({ key: PermissionKeyName, roles: z.array(SessionRole) })
  .meta({ id: 'PermissionDefault' });

export const PermissionDefaults = z
  .object({ keys: z.array(PermissionDefault) })
  .meta({ id: 'PermissionDefaults' });
export type PermissionDefaults = z.infer<typeof PermissionDefaults>;

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
    /** The invited phone masked (`+963 ••• ••• 123`), for «اخرج وادخل برقم الدعوة» (OD-104). */
    phoneMasked: z.string(),
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

export const teamPermissions = defineContract({
  operationId: 'teamPermissions',
  method: 'GET',
  path: '/team/permissions',
  summary: 'The sensitive keys with the roles that grant each by default',
  responses: { 200: PermissionDefaults },
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
  // 400 `validation_failed` (phone, roles, an unknown key), `permission_not_sensitive`;
  // 409 `phone_in_team`: the phone is already a member of this clinic; `branch_archived`.
  responses: { 201: MemberAdded, 400: ErrorEnvelope, 409: ErrorEnvelope },
});

export const teamUpdateMember = defineContract({
  operationId: 'teamUpdateMember',
  method: 'PATCH',
  path: '/team/members/:id',
  summary: 'Change a member’s name, roles and sensitive toggles',
  request: { params: MemberIdParams, body: UpdateMemberRequest },
  // 400 `validation_failed`, `permission_not_sensitive`; 409 `last_owner`, `branch_archived` (a
  // new assignment in an archived branch; one the member already holds there is kept, OD-107), or
  // `owner_role_protected` when another owner's owner role would be removed (OD-97: only they or
  // the super admin may).
  responses: { 200: MemberDetail, 400: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

/**
 * A pending member's phone (OD-103): the earlier link stops; a new one, shown once (an
 * invitation when the phone has an account; the owner sees no difference, OD-76). The same phone
 * again issues a new link. 409 `member_account_exists` (accepted), `member_deactivated`,
 * `phone_in_team`.
 */
export const teamMemberPhone = defineContract({
  operationId: 'teamMemberPhone',
  method: 'PATCH',
  path: '/team/members/:id/phone',
  summary: 'Correct a pending member’s phone; returns their new link once',
  request: { params: MemberIdParams, body: MemberPhoneRequest },
  responses: { 200: MemberLinkIssued, 400: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const teamDeactivateMember = defineContract({
  operationId: 'teamDeactivateMember',
  method: 'POST',
  path: '/team/members/:id/deactivate',
  summary: 'Deactivate a member; their sessions in this clinic end',
  request: { params: MemberIdParams },
  // 409 `self_action`, `member_deactivated`, `last_owner`.
  responses: { 200: MemberDetail, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const teamReactivateMember = defineContract({
  operationId: 'teamReactivateMember',
  method: 'POST',
  path: '/team/members/:id/reactivate',
  summary: 'Reactivate a deactivated member',
  request: { params: MemberIdParams },
  // 409 `member_not_deactivated`.
  responses: { 200: MemberDetail, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const teamMemberLink = defineContract({
  operationId: 'teamMemberLink',
  method: 'POST',
  path: '/team/members/:id/setup-link',
  summary: 'Issue a new link (staff recovery); ends the member’s sessions',
  request: { params: MemberIdParams },
  // 409 `self_action`, `member_deactivated`; `account_shared`: the account works in another
  // clinic too; no link (OD-86).
  responses: { 200: MemberLinkIssued, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

/**
 * Staff TOTP reset (A-01b criterion 3, OD-95): the member's sessions end; they enrol again at
 * the next sign-in. 409 `self_action`, `owner_mfa_platform` (an owner's goes through the super admin),
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
  // 403 `invitation_other_phone`: a valid invitation, another person signed in (OD-104).
  responses: { 204: null, 403: ErrorEnvelope, 404: ErrorEnvelope },
});

export const invitationDecline = defineContract({
  operationId: 'invitationDecline',
  method: 'POST',
  path: '/invitations/decline',
  summary: 'Decline an invitation as the signed-in person it was sent to',
  request: { body: InvitationRequest },
  // 403 `invitation_other_phone` (OD-104).
  responses: { 204: null, 403: ErrorEnvelope, 404: ErrorEnvelope },
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
  // 400 `validation_failed`: not 15, 30 or 60; 403: not the clinic's owner (A-01-11).
  responses: { 200: ClinicSettings, 400: ErrorEnvelope, 403: ErrorEnvelope },
});
