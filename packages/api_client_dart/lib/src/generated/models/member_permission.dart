// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'permission_key_name.dart';

part 'member_permission.g.dart';

@JsonSerializable()
class MemberPermission {
  const MemberPermission({
    required this.granted,
    required this.key,
    required this.overridden,
    required this.roleDefault,
  });

  factory MemberPermission.fromJson(Map<String, Object?> json) =>
      _$MemberPermissionFromJson(json);

  final bool granted;
  final PermissionKeyName key;
  final bool overridden;
  final bool roleDefault;

  Map<String, Object?> toJson() => _$MemberPermissionToJson(this);
}
