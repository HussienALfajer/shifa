// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'member_permission.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MemberPermission _$MemberPermissionFromJson(Map<String, dynamic> json) =>
    MemberPermission(
      granted: json['granted'] as bool,
      key: json['key'] as PermissionKeyName,
      overridden: json['overridden'] as bool,
      roleDefault: json['roleDefault'] as bool,
    );

Map<String, dynamic> _$MemberPermissionToJson(MemberPermission instance) =>
    <String, dynamic>{
      'granted': instance.granted,
      'key': instance.key,
      'overridden': instance.overridden,
      'roleDefault': instance.roleDefault,
    };
