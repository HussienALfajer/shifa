// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session_role_assignment.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SessionRoleAssignment _$SessionRoleAssignmentFromJson(
  Map<String, dynamic> json,
) => SessionRoleAssignment(
  branchId: json['branchId'] as String?,
  role: $enumDecode(_$SessionRoleEnumMap, json['role']),
  tenantId: json['tenantId'] as String,
);

Map<String, dynamic> _$SessionRoleAssignmentToJson(
  SessionRoleAssignment instance,
) => <String, dynamic>{
  'branchId': instance.branchId,
  'role': instance.role,
  'tenantId': instance.tenantId,
};

const _$SessionRoleEnumMap = {
  SessionRole.owner: 'owner',
  SessionRole.doctor: 'doctor',
  SessionRole.receptionist: 'receptionist',
  SessionRole.assistant: 'assistant',
  SessionRole.accountant: 'accountant',
};
