// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'session_role.dart';

part 'session_role_assignment.g.dart';

@JsonSerializable()
class SessionRoleAssignment {
  const SessionRoleAssignment({
    required this.branchId,
    required this.role,
    required this.tenantId,
  });

  factory SessionRoleAssignment.fromJson(Map<String, Object?> json) =>
      _$SessionRoleAssignmentFromJson(json);

  @JsonKey(includeIfNull: true)
  final String? branchId;
  final SessionRole role;
  final String tenantId;

  Map<String, Object?> toJson() => _$SessionRoleAssignmentToJson(this);
}
