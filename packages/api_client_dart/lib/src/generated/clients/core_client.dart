// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/active_clinic.dart';
import '../models/add_member_request.dart';
import '../models/archive_branch_preview.dart';
import '../models/branch.dart';
import '../models/branch_list.dart';
import '../models/capabilities.dart';
import '../models/change_password_request.dart';
import '../models/clinic_created.dart';
import '../models/clinic_detail.dart';
import '../models/clinic_entitlements.dart';
import '../models/clinic_list.dart';
import '../models/clinic_setting_list.dart';
import '../models/clinic_settings.dart';
import '../models/clinic_support_grants.dart';
import '../models/clinic_type.dart';
import '../models/create_branch_request.dart';
import '../models/create_clinic_request.dart';
import '../models/ended_sessions.dart';
import '../models/entitlement_item.dart';
import '../models/flag_list.dart';
import '../models/flag_view.dart';
import '../models/health_status.dart';
import '../models/invitation_request.dart';
import '../models/invitation_view.dart';
import '../models/lock_setting_request.dart';
import '../models/member_added.dart';
import '../models/member_detail.dart';
import '../models/member_link_issued.dart';
import '../models/member_list.dart';
import '../models/member_phone_request.dart';
import '../models/mfa_enrolled.dart';
import '../models/mfa_passed.dart';
import '../models/mfa_status.dart';
import '../models/my_clinics.dart';
import '../models/my_profile.dart';
import '../models/open_support_grant_request.dart';
import '../models/opened_support_grant.dart';
import '../models/override_history.dart';
import '../models/owner_phone_request.dart';
import '../models/permission_defaults.dart';
import '../models/platform_support_grants.dart';
import '../models/recovery_codes.dart';
import '../models/renew_recovery_codes.dart';
import '../models/session_list.dart';
import '../models/session_view.dart';
import '../models/set_flag_request.dart';
import '../models/set_override_request.dart';
import '../models/set_password_request.dart';
import '../models/setting_view.dart';
import '../models/setup_link_issued.dart';
import '../models/setup_link_request.dart';
import '../models/setup_link_view.dart';
import '../models/sign_in_request.dart';
import '../models/subscription.dart';
import '../models/support_grant_view.dart';
import '../models/support_handoff.dart';
import '../models/support_handoff_request.dart';
import '../models/switch_request.dart';
import '../models/totp_challenge.dart';
import '../models/totp_enrol_confirm.dart';
import '../models/totp_enrol_start.dart';
import '../models/totp_reenrol_confirm.dart';
import '../models/totp_reenrol_start.dart';
import '../models/type_preview.dart';
import '../models/update_branch_request.dart';
import '../models/update_clinic_request.dart';
import '../models/update_clinic_settings_request.dart';
import '../models/update_member_request.dart';

part 'core_client.g.dart';

@RestApi()
abstract class CoreClient {
  factory CoreClient(Dio dio, {String? baseUrl}) = _CoreClient;

  /// Whether TOTP is enrolled, since when, and recovery codes left
  @GET('/auth/mfa')
  Future<MfaStatus> authMfaStatus();

  /// Pass the second factor for this session; rotates the session cookie
  @POST('/auth/mfa/challenge')
  Future<MfaPassed> authMfaChallenge({@Body() required TotpChallenge body});

  /// Confirm TOTP enrolment with one code; returns the recovery codes once
  @POST('/auth/mfa/enrol/confirm')
  Future<MfaEnrolled> authMfaEnrolConfirm({
    @Body() required TotpEnrolConfirm body,
  });

  /// Start TOTP enrolment: a new key (replaces an unconfirmed one)
  @POST('/auth/mfa/enrol/start')
  Future<TotpEnrolStart> authMfaEnrolStart();

  /// Confirm the new TOTP with a code from the new app; returns new recovery codes once
  @POST('/auth/mfa/re-enrol/confirm')
  Future<RecoveryCodes> authMfaReenrolConfirm({
    @Body() required TotpReenrolConfirm body,
  });

  /// Start moving TOTP to a new phone, confirmed by a current code from the old app
  @POST('/auth/mfa/re-enrol/start')
  Future<TotpEnrolStart> authMfaReenrolStart({
    @Body() required TotpReenrolStart body,
  });

  /// Replace the recovery codes with a new set, confirmed with a TOTP code
  @POST('/auth/mfa/recovery-codes')
  Future<RecoveryCodes> authMfaRecoveryCodes({
    @Body() required RenewRecoveryCodes body,
  });

  /// Change the signed-in person’s password; ends their other sessions
  @POST('/auth/password')
  Future<SessionView> authChangePassword({
    @Body() required ChangePasswordRequest body,
  });

  /// The current session
  @GET('/auth/session')
  Future<SessionView> authSession();

  /// The signed-in person’s sessions
  @GET('/auth/sessions')
  Future<SessionList> authSessions();

  /// End every session of the signed-in person but this one
  @POST('/auth/sessions/end-others')
  Future<EndedSessions> authEndOtherSessions();

  /// End one of the signed-in person’s sessions
  @DELETE('/auth/sessions/{id}')
  Future<void> authEndSession({@Path('id') required String id});

  /// Set the password through a setup link and sign in
  @POST('/auth/setup-link/consume')
  Future<SessionView> authSetupLinkConsume({
    @Body() required SetPasswordRequest body,
  });

  /// What a setup link is for, before the password is set
  @POST('/auth/setup-link/view')
  Future<SetupLinkView> authSetupLinkView({
    @Body() required SetupLinkRequest body,
  });

  /// Sign in with phone and password; sets the session cookie
  @POST('/auth/sign-in')
  Future<SessionView> authSignIn({@Body() required SignInRequest body});

  /// End this session and clear the cookie
  @POST('/auth/sign-out')
  Future<void> authSignOut();

  /// End the support grant of this support session (the one write it may make)
  @POST('/auth/support/end')
  Future<void> authEndSupport();

  /// Exchange a support hand-off for a support session; sets the support cookie
  @POST('/auth/support/session')
  Future<SessionView> authSupportSession({
    @Body() required SupportHandoffRequest body,
  });

  /// The clinic’s active and archived branches
  @GET('/branches')
  Future<BranchList> branchesList();

  /// Add a branch
  @POST('/branches')
  Future<Branch> branchesCreate({@Body() required CreateBranchRequest body});

  /// Rename a branch or change its address and phone
  @PATCH('/branches/{id}')
  Future<Branch> branchesUpdate({
    @Path('id') required String id,
    @Body() required UpdateBranchRequest body,
  });

  /// Archive a branch; members left without an active branch are signed out here
  @POST('/branches/{id}/archive')
  Future<Branch> branchesArchive({@Path('id') required String id});

  /// Whether a branch can be archived and whose sessions would end
  @GET('/branches/{id}/archive-preview')
  Future<ArchiveBranchPreview> branchesArchivePreview({
    @Path('id') required String id,
  });

  /// Restore an archived branch
  @POST('/branches/{id}/restore')
  Future<Branch> branchesRestore({@Path('id') required String id});

  /// What the active clinic may use: features, limits with use, evaluated flags
  @GET('/clinic/capabilities')
  Future<Capabilities> clinicCapabilities();

  /// The clinic’s settings (automatic sign-out)
  @GET('/clinic/settings')
  Future<ClinicSettings> clinicSettings();

  /// Change the clinic’s automatic sign-out (15, 30 or 60 minutes)
  @PATCH('/clinic/settings')
  Future<ClinicSettings> clinicUpdateSettings({
    @Body() required UpdateClinicSettingsRequest body,
  });

  /// The clinic’s plan, status, end date, limits with use and enabled features (owner)
  @GET('/clinic/subscription')
  Future<Subscription> clinicSubscription();

  /// The clinic’s open support grants (banner) and every grant (log)
  @GET('/clinic/support-grants')
  Future<ClinicSupportGrants> clinicSupportGrants();

  /// An owner ends a super admin’s support access to the clinic
  @POST('/clinic/support-grants/{id}/end')
  Future<SupportGrantView> clinicEndSupportGrant({
    @Path('id') required String id,
  });

  /// Liveness probe
  @GET('/health/live')
  Future<HealthStatus> healthLive();

  /// Readiness probe
  @GET('/health/ready')
  Future<HealthStatus> healthReady();

  /// Accept an invitation as the signed-in person it was sent to
  @POST('/invitations/accept')
  Future<void> invitationAccept({@Body() required InvitationRequest body});

  /// Decline an invitation as the signed-in person it was sent to
  @POST('/invitations/decline')
  Future<void> invitationDecline({@Body() required InvitationRequest body});

  /// The clinic, name, roles and scope of an invitation
  @POST('/invitations/view')
  Future<InvitationView> invitationView({
    @Body() required InvitationRequest body,
  });

  /// The signed-in person’s own profile
  @GET('/me')
  Future<MyProfile> meProfile();

  /// The signed-in person’s clinics and pending invitations (clinic chooser)
  @GET('/me/clinics')
  Future<MyClinics> meClinics();

  /// Switch the session to one of the person’s clinics and branches
  @POST('/me/switch')
  Future<ActiveClinic> meSwitch({@Body() required SwitchRequest body});

  /// Clinics, newest first; search by name
  @GET('/platform/clinics')
  Future<ClinicList> platformClinics({@Query('search') String? search});

  /// Create a clinic and its owner; returns the owner’s setup link once
  @POST('/platform/clinics')
  Future<ClinicCreated> platformCreateClinic({
    @Body() required CreateClinicRequest body,
  });

  /// A clinic and its owner card
  @GET('/platform/clinics/{id}')
  Future<ClinicDetail> platformClinic({@Path('id') required String id});

  /// Change a clinic’s type (and so its plan), status or subscription end date
  @PATCH('/platform/clinics/{id}')
  Future<ClinicDetail> platformUpdateClinic({
    @Path('id') required String id,
    @Body() required UpdateClinicRequest body,
  });

  /// A clinic’s plan and every catalogue key with plan value, override and effective value
  @GET('/platform/clinics/{id}/entitlements')
  Future<ClinicEntitlements> platformClinicEntitlements({
    @Path('id') required String id,
  });

  /// Remove a clinic’s override of one key
  @DELETE('/platform/clinics/{id}/overrides/{key}')
  Future<EntitlementItem> platformRemoveOverride({
    @Path('id') required String id,
    @Path('key') required String key,
  });

  /// Set or change a clinic’s override of one key (reason required, optional expiry)
  @PUT('/platform/clinics/{id}/overrides/{key}')
  Future<EntitlementItem> platformSetOverride({
    @Path('id') required String id,
    @Path('key') required String key,
    @Body() required SetOverrideRequest body,
  });

  /// Every change of one key for a clinic, newest first
  @GET('/platform/clinics/{id}/overrides/{key}/history')
  Future<OverrideHistory> platformOverrideHistory({
    @Path('id') required String id,
    @Path('key') required String key,
  });

  /// Correct a pending owner’s phone; returns the new setup link once
  @PATCH('/platform/clinics/{id}/owner')
  Future<SetupLinkIssued> platformOwnerPhone({
    @Path('id') required String id,
    @Body() required OwnerPhoneRequest body,
  });

  /// End every session of the owner
  @POST('/platform/clinics/{id}/owner/end-sessions')
  Future<void> platformOwnerEndSessions({@Path('id') required String id});

  /// Reset the owner’s TOTP: enrol again at next sign-in (ends the owner’s sessions)
  @POST('/platform/clinics/{id}/owner/reset-mfa')
  Future<void> platformOwnerResetMfa({@Path('id') required String id});

  /// Issue a new setup link to the owner (ends the owner’s sessions)
  @POST('/platform/clinics/{id}/owner/setup-link')
  Future<SetupLinkIssued> platformOwnerSetupLink({
    @Path('id') required String id,
  });

  /// Every setting of a clinic with its effective value, source and lock
  @GET('/platform/clinics/{id}/settings')
  Future<ClinicSettingList> platformClinicSettings({
    @Path('id') required String id,
  });

  /// Unlock a clinic’s setting; the value is inherited again
  @DELETE('/platform/clinics/{id}/settings/{key}/lock')
  Future<SettingView> platformUnlockSetting({
    @Path('id') required String id,
    @Path('key') required String key,
  });

  /// Set and lock a clinic’s value of one setting («قفل بقيمة»)
  @PUT('/platform/clinics/{id}/settings/{key}/lock')
  Future<SettingView> platformLockSetting({
    @Path('id') required String id,
    @Path('key') required String key,
    @Body() required LockSettingRequest body,
  });

  /// A clinic’s support grants: this super admin’s open one and the log
  @GET('/platform/clinics/{id}/support-grants')
  Future<PlatformSupportGrants> platformSupportGrants({
    @Path('id') required String id,
  });

  /// Open read-only support access to a clinic; answers the hand-off URL
  @POST('/platform/clinics/{id}/support-grants')
  Future<OpenedSupportGrant> platformOpenSupportGrant({
    @Path('id') required String id,
    @Body() required OpenSupportGrantRequest body,
  });

  /// The limits a clinic would have under another type, against its current use
  @GET('/platform/clinics/{id}/type-preview')
  Future<TypePreview> platformTypePreview({
    @Path('id') required String id,
    @Query('type') required ClinicType type,
  });

  /// Every flag declared in code, with its mode, clinics, reason and last change
  @GET('/platform/flags')
  Future<FlagList> platformFlags();

  /// Set a flag off for all, on for all or on for selected clinics
  @PUT('/platform/flags/{key}')
  Future<FlagView> platformSetFlag({
    @Path('key') required String key,
    @Body() required SetFlagRequest body,
  });

  /// End this super admin’s open grant
  @POST('/platform/support-grants/{id}/end')
  Future<SupportGrantView> platformEndSupportGrant({
    @Path('id') required String id,
  });

  /// A new single-use hand-off for this super admin’s open grant («فتح عيادة الويب»)
  @POST('/platform/support-grants/{id}/handoff')
  Future<SupportHandoff> platformSupportHandoff({
    @Path('id') required String id,
  });

  /// The clinic’s members with roles, scope and status
  @GET('/team/members')
  Future<MemberList> teamMembers();

  /// Add a member with roles; returns their link once
  @POST('/team/members')
  Future<MemberAdded> teamAddMember({@Body() required AddMemberRequest body});

  /// A member with toggles and the role defaults
  @GET('/team/members/{id}')
  Future<MemberDetail> teamMember({@Path('id') required String id});

  /// Change a member’s name, roles and sensitive toggles
  @PATCH('/team/members/{id}')
  Future<MemberDetail> teamUpdateMember({
    @Path('id') required String id,
    @Body() required UpdateMemberRequest body,
  });

  /// Deactivate a member; their sessions in this clinic end
  @POST('/team/members/{id}/deactivate')
  Future<MemberDetail> teamDeactivateMember({@Path('id') required String id});

  /// Correct a pending member’s phone; returns their new link once
  @PATCH('/team/members/{id}/phone')
  Future<MemberLinkIssued> teamMemberPhone({
    @Path('id') required String id,
    @Body() required MemberPhoneRequest body,
  });

  /// Reactivate a deactivated member
  @POST('/team/members/{id}/reactivate')
  Future<MemberDetail> teamReactivateMember({@Path('id') required String id});

  /// Reset a member’s TOTP; ends the member’s sessions
  @POST('/team/members/{id}/reset-mfa')
  Future<MemberDetail> teamMemberResetMfa({@Path('id') required String id});

  /// Issue a new link (staff recovery); ends the member’s sessions
  @POST('/team/members/{id}/setup-link')
  Future<MemberLinkIssued> teamMemberLink({@Path('id') required String id});

  /// The sensitive keys with the roles that grant each by default
  @GET('/team/permissions')
  Future<PermissionDefaults> teamPermissions();
}
