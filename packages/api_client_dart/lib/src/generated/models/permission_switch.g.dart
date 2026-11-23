// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'permission_switch.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PermissionSwitch _$PermissionSwitchFromJson(Map<String, dynamic> json) =>
    PermissionSwitch(
      granted: json['granted'] as bool?,
      key: json['key'] as PermissionKeyName,
    );

Map<String, dynamic> _$PermissionSwitchToJson(PermissionSwitch instance) =>
    <String, dynamic>{'granted': instance.granted, 'key': instance.key};
