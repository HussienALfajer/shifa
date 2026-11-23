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
  roles: (json['roles'] as List<dynamic>)
      .map((e) => SessionRoleAssignment.fromJson(e as Map<String, dynamic>))
      .toList(),
  sessionId: json['sessionId'] as String,
  tenantId: json['tenantId'] as String?,
  userId: json['userId'] as String,
);

Map<String, dynamic> _$SessionViewToJson(SessionView instance) =>
    <String, dynamic>{
      'absoluteExpiresAt': instance.absoluteExpiresAt.toIso8601String(),
      'branchId': instance.branchId,
      'idleExpiresAt': instance.idleExpiresAt.toIso8601String(),
      'idleMinutes': instance.idleMinutes,
      'roles': instance.roles,
      'sessionId': instance.sessionId,
      'tenantId': instance.tenantId,
      'userId': instance.userId,
    };
