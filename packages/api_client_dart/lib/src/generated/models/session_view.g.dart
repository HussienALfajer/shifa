// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session_view.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SessionView _$SessionViewFromJson(Map<String, dynamic> json) => SessionView(
  absoluteExpiresAt: DateTime.parse(json['absoluteExpiresAt'] as String),
  branchId: json['branchId'] as String?,
  idleExpiresAt: DateTime.parse(json['idleExpiresAt'] as String),
  idleMinutes: (json['idleMinutes'] as num).toInt(),
  mfa: $enumDecode(_$MfaStateEnumMap, json['mfa']),
  mfaRequired: json['mfaRequired'] as bool,
  platformAdmin: json['platformAdmin'] as bool,
  roles: (json['roles'] as List<dynamic>)
      .map((e) => SessionRoleAssignment.fromJson(e as Map<String, dynamic>))
      .toList(),
  sessionId: json['sessionId'] as String,
  support: json['support'] == null
      ? null
      : SupportSessionView.fromJson(json['support'] as Map<String, dynamic>),
  tenantId: json['tenantId'] as String?,
  userId: json['userId'] as String,
);

Map<String, dynamic> _$SessionViewToJson(SessionView instance) =>
    <String, dynamic>{
      'absoluteExpiresAt': instance.absoluteExpiresAt.toIso8601String(),
      'branchId': instance.branchId,
      'idleExpiresAt': instance.idleExpiresAt.toIso8601String(),
      'idleMinutes': instance.idleMinutes,
      'mfa': instance.mfa,
      'mfaRequired': instance.mfaRequired,
      'platformAdmin': instance.platformAdmin,
      'roles': instance.roles,
      'sessionId': instance.sessionId,
      'support': instance.support,
      'tenantId': instance.tenantId,
      'userId': instance.userId,
    };

const _$MfaStateEnumMap = {
  MfaState.none: 'none',
  MfaState.pending: 'pending',
  MfaState.verified: 'verified',
};
