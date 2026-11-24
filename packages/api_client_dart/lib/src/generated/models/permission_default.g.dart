// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'permission_default.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PermissionDefault _$PermissionDefaultFromJson(Map<String, dynamic> json) =>
    PermissionDefault(
      key: json['key'] as PermissionKeyName,
      roles: (json['roles'] as List<dynamic>)
          .map((e) => $enumDecode(_$SessionRoleEnumMap, e))
          .toList(),
    );

Map<String, dynamic> _$PermissionDefaultToJson(PermissionDefault instance) =>
    <String, dynamic>{'key': instance.key, 'roles': instance.roles};

const _$SessionRoleEnumMap = {
  SessionRole.owner: 'owner',
  SessionRole.doctor: 'doctor',
  SessionRole.receptionist: 'receptionist',
  SessionRole.assistant: 'assistant',
  SessionRole.accountant: 'accountant',
};
