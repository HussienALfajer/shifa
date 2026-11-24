// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'permission_key_name.dart';

part 'permission_setting.g.dart';

@JsonSerializable()
class PermissionSetting {
  const PermissionSetting({required this.granted, required this.key});

  factory PermissionSetting.fromJson(Map<String, Object?> json) =>
      _$PermissionSettingFromJson(json);

  final bool granted;
  final PermissionKeyName key;

  Map<String, Object?> toJson() => _$PermissionSettingToJson(this);
}
