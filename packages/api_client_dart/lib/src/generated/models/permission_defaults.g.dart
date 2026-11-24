// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'permission_defaults.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PermissionDefaults _$PermissionDefaultsFromJson(Map<String, dynamic> json) =>
    PermissionDefaults(
      keys: (json['keys'] as List<dynamic>)
          .map((e) => PermissionDefault.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$PermissionDefaultsToJson(PermissionDefaults instance) =>
    <String, dynamic>{'keys': instance.keys};
