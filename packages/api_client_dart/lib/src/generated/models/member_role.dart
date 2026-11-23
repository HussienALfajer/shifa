// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'session_role.dart';

part 'member_role.g.dart';

@JsonSerializable()
class MemberRole {
  const MemberRole({
    required this.branchId,
    required this.branchName,
    required this.role,
  });

  factory MemberRole.fromJson(Map<String, Object?> json) =>
      _$MemberRoleFromJson(json);

  @JsonKey(includeIfNull: true)
  final String? branchId;
  @JsonKey(includeIfNull: true)
  final String? branchName;
  final SessionRole role;

  Map<String, Object?> toJson() => _$MemberRoleToJson(this);
}
