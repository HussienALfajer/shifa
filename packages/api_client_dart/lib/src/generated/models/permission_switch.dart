// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'permission_key_name.dart';

part 'permission_switch.g.dart';

@JsonSerializable()
class PermissionSwitch {
  const PermissionSwitch({required this.granted, required this.key});

  factory PermissionSwitch.fromJson(Map<String, Object?> json) =>
      _$PermissionSwitchFromJson(json);

  @JsonKey(includeIfNull: true)
  final bool? granted;
  final PermissionKeyName key;

  Map<String, Object?> toJson() => _$PermissionSwitchToJson(this);
}
