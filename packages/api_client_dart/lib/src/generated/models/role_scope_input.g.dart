// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'role_scope_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoleScopeInput _$RoleScopeInputFromJson(Map<String, dynamic> json) =>
    RoleScopeInput(
      branchId: json['branchId'] as String?,
      role: $enumDecode(_$SessionRoleEnumMap, json['role']),
    );

Map<String, dynamic> _$RoleScopeInputToJson(RoleScopeInput instance) =>
    <String, dynamic>{'branchId': instance.branchId, 'role': instance.role};

const _$SessionRoleEnumMap = {
  SessionRole.owner: 'owner',
  SessionRole.doctor: 'doctor',
  SessionRole.receptionist: 'receptionist',
  SessionRole.assistant: 'assistant',
  SessionRole.accountant: 'accountant',
};
