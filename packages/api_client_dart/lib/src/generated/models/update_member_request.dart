// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'permission_switch.dart';
import 'role_scope_input.dart';

part 'update_member_request.g.dart';

@JsonSerializable()
class UpdateMemberRequest {
  const UpdateMemberRequest({this.permissions, this.roles});

  factory UpdateMemberRequest.fromJson(Map<String, Object?> json) =>
      _$UpdateMemberRequestFromJson(json);

  @JsonKey(includeIfNull: false)
  final List<PermissionSwitch>? permissions;
  @JsonKey(includeIfNull: false)
  final List<RoleScopeInput>? roles;

  Map<String, Object?> toJson() => _$UpdateMemberRequestToJson(this);
}
