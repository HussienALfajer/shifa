// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'permission_key_name.dart';
import 'session_role.dart';

part 'permission_default.g.dart';

@JsonSerializable()
class PermissionDefault {
  const PermissionDefault({required this.key, required this.roles});

  factory PermissionDefault.fromJson(Map<String, Object?> json) =>
      _$PermissionDefaultFromJson(json);

  final PermissionKeyName key;
  final List<SessionRole> roles;

  Map<String, Object?> toJson() => _$PermissionDefaultToJson(this);
}
