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
  until: json['until'] == null ? null : DateTime.parse(json['until'] as String),
);

Map<String, dynamic> _$ErrorBodyToJson(ErrorBody instance) => <String, dynamic>{
  'code': instance.code,
  'details': ?instance.details,
  'message': instance.message,
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
};
