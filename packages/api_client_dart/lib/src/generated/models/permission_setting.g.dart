// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'permission_setting.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PermissionSetting _$PermissionSettingFromJson(Map<String, dynamic> json) =>
    PermissionSetting(
      granted: json['granted'] as bool,
      key: json['key'] as PermissionKeyName,
    );

Map<String, dynamic> _$PermissionSettingToJson(PermissionSetting instance) =>
    <String, dynamic>{'granted': instance.granted, 'key': instance.key};
