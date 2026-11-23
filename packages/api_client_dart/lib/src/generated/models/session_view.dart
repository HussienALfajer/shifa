// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'session_role_assignment.dart';

part 'session_view.g.dart';

@JsonSerializable()
class SessionView {
  const SessionView({
    required this.absoluteExpiresAt,
    required this.branchId,
    required this.idleExpiresAt,
    required this.idleMinutes,
    required this.roles,
    required this.sessionId,
    required this.tenantId,
    required this.userId,
  });

  factory SessionView.fromJson(Map<String, Object?> json) =>
      _$SessionViewFromJson(json);

  final DateTime absoluteExpiresAt;
  @JsonKey(includeIfNull: true)
  final String? branchId;
  final DateTime idleExpiresAt;
  final int idleMinutes;
  final List<SessionRoleAssignment> roles;
  final String sessionId;
  @JsonKey(includeIfNull: true)
  final String? tenantId;
  final String userId;

  Map<String, Object?> toJson() => _$SessionViewToJson(this);
}
