// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'session_role.dart';

part 'invitation_role.g.dart';

@JsonSerializable()
class InvitationRole {
  const InvitationRole({required this.branchName, required this.role});

  factory InvitationRole.fromJson(Map<String, Object?> json) =>
      _$InvitationRoleFromJson(json);

  @JsonKey(includeIfNull: true)
  final String? branchName;
  final SessionRole role;

  Map<String, Object?> toJson() => _$InvitationRoleToJson(this);
}
