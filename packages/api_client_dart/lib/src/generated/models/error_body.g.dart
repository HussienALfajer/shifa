// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'error_body.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ErrorBody _$ErrorBodyFromJson(Map<String, dynamic> json) => ErrorBody(
  code: $enumDecode(_$ErrorCodeEnumMap, json['code']),
  message: json['message'] as String,
  details: (json['details'] as List<dynamic>?)
      ?.map((e) => ValidationIssue.fromJson(e as Map<String, dynamic>))
      .toList(),
  limitReached: json['limitReached'] == null
      ? null
      : LimitReached.fromJson(json['limitReached'] as Map<String, dynamic>),
  place: $enumDecodeNullable(_$PlaceKindEnumMap, json['place']),
  reason: $enumDecodeNullable(_$SessionEndReasonEnumMap, json['reason']),
  stale: json['stale'] == null
      ? null
      : StaleChange.fromJson(json['stale'] as Map<String, dynamic>),
  supportEnded: json['supportEnded'] == null
      ? null
      : SupportEnded.fromJson(json['supportEnded'] as Map<String, dynamic>),
  until: json['until'] == null ? null : DateTime.parse(json['until'] as String),
);

Map<String, dynamic> _$ErrorBodyToJson(ErrorBody instance) => <String, dynamic>{
  'code': instance.code,
  'details': ?instance.details,
  'limitReached': ?instance.limitReached,
  'message': instance.message,
  'place': ?instance.place,
  'reason': ?instance.reason,
  'stale': ?instance.stale,
  'supportEnded': ?instance.supportEnded,
  'until': ?instance.until?.toIso8601String(),
};

const _$ErrorCodeEnumMap = {
  ErrorCode.badRequest: 'bad_request',
  ErrorCode.validationFailed: 'validation_failed',
  ErrorCode.unauthorized: 'unauthorized',
  ErrorCode.forbidden: 'forbidden',
  ErrorCode.notFound: 'not_found',
  ErrorCode.methodNotAllowed: 'method_not_allowed',
  ErrorCode.notAcceptable: 'not_acceptable',
  ErrorCode.requestTimeout: 'request_timeout',
  ErrorCode.conflict: 'conflict',
  ErrorCode.payloadTooLarge: 'payload_too_large',
  ErrorCode.uriTooLong: 'uri_too_long',
  ErrorCode.unsupportedMediaType: 'unsupported_media_type',
  ErrorCode.unprocessableEntity: 'unprocessable_entity',
  ErrorCode.tooManyRequests: 'too_many_requests',
  ErrorCode.internalError: 'internal_error',
  ErrorCode.serviceUnavailable: 'service_unavailable',
  ErrorCode.invalidCredentials: 'invalid_credentials',
  ErrorCode.phoneLocked: 'phone_locked',
  ErrorCode.ipBlocked: 'ip_blocked',
  ErrorCode.sessionExpired: 'session_expired',
  ErrorCode.linkInvalid: 'link_invalid',
  ErrorCode.passwordTooShort: 'password_too_short',
  ErrorCode.passwordCommon: 'password_common',
  ErrorCode.passwordContainsPhone: 'password_contains_phone',
  ErrorCode.mfaEnrolmentRequired: 'mfa_enrolment_required',
  ErrorCode.mfaChallengeRequired: 'mfa_challenge_required',
  ErrorCode.mfaLocked: 'mfa_locked',
  ErrorCode.invalidCode: 'invalid_code',
  ErrorCode.clockSkew: 'clock_skew',
  ErrorCode.ownerSetupPending: 'owner_setup_pending',
  ErrorCode.lastOwner: 'last_owner',
  ErrorCode.phoneInTeam: 'phone_in_team',
  ErrorCode.accountShared: 'account_shared',
  ErrorCode.permissionNotSensitive: 'permission_not_sensitive',
  ErrorCode.lastBranch: 'last_branch',
  ErrorCode.branchArchived: 'branch_archived',
  ErrorCode.clinicSuspended: 'clinic_suspended',
  ErrorCode.noClinic: 'no_clinic',
  ErrorCode.branchNotHeld: 'branch_not_held',
  ErrorCode.passwordUnchanged: 'password_unchanged',
  ErrorCode.branchRequired: 'branch_required',
  ErrorCode.ownerMfaPlatform: 'owner_mfa_platform',
  ErrorCode.mfaAlreadyEnrolled: 'mfa_already_enrolled',
  ErrorCode.mfaNotStarted: 'mfa_not_started',
  ErrorCode.mfaNotOwed: 'mfa_not_owed',
  ErrorCode.mfaNotEnrolled: 'mfa_not_enrolled',
  ErrorCode.ownerRoleProtected: 'owner_role_protected',
  ErrorCode.ownerAccountExists: 'owner_account_exists',
  ErrorCode.memberDeactivated: 'member_deactivated',
  ErrorCode.memberNotDeactivated: 'member_not_deactivated',
  ErrorCode.memberAccountExists: 'member_account_exists',
  ErrorCode.selfAction: 'self_action',
  ErrorCode.invitationOtherPhone: 'invitation_other_phone',
  ErrorCode.branchNotArchived: 'branch_not_archived',
  ErrorCode.limitReached: 'limit_reached',
  ErrorCode.featureUnavailable: 'feature_unavailable',
  ErrorCode.settingLocked: 'setting_locked',
  ErrorCode.settingNotLockable: 'setting_not_lockable',
  ErrorCode.supportActive: 'support_active',
  ErrorCode.supportEnded: 'support_ended',
  ErrorCode.supportReadOnly: 'support_read_only',
  ErrorCode.placeNameTaken: 'place_name_taken',
  ErrorCode.placeArchived: 'place_archived',
  ErrorCode.placeNotArchived: 'place_not_archived',
  ErrorCode.announcementLink: 'announcement_link',
  ErrorCode.announcementEnded: 'announcement_ended',
  ErrorCode.previousFileNumberTaken: 'previous_file_number_taken',
  ErrorCode.patientIdTaken: 'patient_id_taken',
  ErrorCode.patientArchived: 'patient_archived',
  ErrorCode.patientNotArchived: 'patient_not_archived',
  ErrorCode.patientMerged: 'patient_merged',
  ErrorCode.stale: 'stale',
  ErrorCode.rateLimited: 'rate_limited',
};

const _$PlaceKindEnumMap = {PlaceKind.city: 'city', PlaceKind.area: 'area'};

const _$SessionEndReasonEnumMap = {
  SessionEndReason.idle: 'idle',
  SessionEndReason.absolute: 'absolute',
  SessionEndReason.ended: 'ended',
  SessionEndReason.supportEnded: 'support_ended',
};
