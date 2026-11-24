// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Stable machine-readable error code.
@JsonEnum()
enum ErrorCode {
  @JsonValue('bad_request')
  badRequest('bad_request'),
  @JsonValue('validation_failed')
  validationFailed('validation_failed'),
  @JsonValue('unauthorized')
  unauthorized('unauthorized'),
  @JsonValue('forbidden')
  forbidden('forbidden'),
  @JsonValue('not_found')
  notFound('not_found'),
  @JsonValue('method_not_allowed')
  methodNotAllowed('method_not_allowed'),
  @JsonValue('not_acceptable')
  notAcceptable('not_acceptable'),
  @JsonValue('request_timeout')
  requestTimeout('request_timeout'),
  @JsonValue('conflict')
  conflict('conflict'),
  @JsonValue('payload_too_large')
  payloadTooLarge('payload_too_large'),
  @JsonValue('uri_too_long')
  uriTooLong('uri_too_long'),
  @JsonValue('unsupported_media_type')
  unsupportedMediaType('unsupported_media_type'),
  @JsonValue('unprocessable_entity')
  unprocessableEntity('unprocessable_entity'),
  @JsonValue('too_many_requests')
  tooManyRequests('too_many_requests'),
  @JsonValue('internal_error')
  internalError('internal_error'),
  @JsonValue('service_unavailable')
  serviceUnavailable('service_unavailable'),
  @JsonValue('invalid_credentials')
  invalidCredentials('invalid_credentials'),
  @JsonValue('phone_locked')
  phoneLocked('phone_locked'),
  @JsonValue('ip_blocked')
  ipBlocked('ip_blocked'),
  @JsonValue('session_expired')
  sessionExpired('session_expired'),
  @JsonValue('link_invalid')
  linkInvalid('link_invalid'),
  @JsonValue('password_too_short')
  passwordTooShort('password_too_short'),
  @JsonValue('password_common')
  passwordCommon('password_common'),
  @JsonValue('password_contains_phone')
  passwordContainsPhone('password_contains_phone'),
  @JsonValue('mfa_enrolment_required')
  mfaEnrolmentRequired('mfa_enrolment_required'),
  @JsonValue('mfa_challenge_required')
  mfaChallengeRequired('mfa_challenge_required'),
  @JsonValue('mfa_locked')
  mfaLocked('mfa_locked'),
  @JsonValue('invalid_code')
  invalidCode('invalid_code'),
  @JsonValue('clock_skew')
  clockSkew('clock_skew'),
  @JsonValue('owner_setup_pending')
  ownerSetupPending('owner_setup_pending'),
  @JsonValue('last_owner')
  lastOwner('last_owner'),
  @JsonValue('phone_in_team')
  phoneInTeam('phone_in_team'),
  @JsonValue('account_shared')
  accountShared('account_shared'),
  @JsonValue('permission_not_sensitive')
  permissionNotSensitive('permission_not_sensitive'),
  @JsonValue('last_branch')
  lastBranch('last_branch'),
  @JsonValue('branch_archived')
  branchArchived('branch_archived'),
  @JsonValue('clinic_suspended')
  clinicSuspended('clinic_suspended'),
  @JsonValue('no_clinic')
  noClinic('no_clinic'),
  @JsonValue('branch_not_held')
  branchNotHeld('branch_not_held'),
  @JsonValue('password_unchanged')
  passwordUnchanged('password_unchanged'),
  @JsonValue('branch_required')
  branchRequired('branch_required'),
  @JsonValue('owner_mfa_platform')
  ownerMfaPlatform('owner_mfa_platform'),
  @JsonValue('mfa_already_enrolled')
  mfaAlreadyEnrolled('mfa_already_enrolled'),
  @JsonValue('mfa_not_started')
  mfaNotStarted('mfa_not_started'),
  @JsonValue('mfa_not_owed')
  mfaNotOwed('mfa_not_owed'),
  @JsonValue('mfa_not_enrolled')
  mfaNotEnrolled('mfa_not_enrolled'),
  @JsonValue('owner_role_protected')
  ownerRoleProtected('owner_role_protected'),
  @JsonValue('owner_account_exists')
  ownerAccountExists('owner_account_exists'),
  @JsonValue('member_deactivated')
  memberDeactivated('member_deactivated'),
  @JsonValue('member_not_deactivated')
  memberNotDeactivated('member_not_deactivated'),
  @JsonValue('member_account_exists')
  memberAccountExists('member_account_exists'),
  @JsonValue('self_action')
  selfAction('self_action'),
  @JsonValue('invitation_other_phone')
  invitationOtherPhone('invitation_other_phone'),
  @JsonValue('branch_not_archived')
  branchNotArchived('branch_not_archived');

  const ErrorCode(this.json);

  final String? json;
  String toJson() {
    final value = json;
    if (value == null) {
      throw StateError(
        'Cannot convert enum value with null JSON representation to String. '
        'This usually happens for \$unknown or @JsonValue(null) entries.',
      );
    }
    return value as String;
  }

  @override
  String toString() => json?.toString() ?? super.toString();
}
