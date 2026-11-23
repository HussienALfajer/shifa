// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'session_role.dart';

part 'role_scope_input.g.dart';

@JsonSerializable()
class RoleScopeInput {
  const RoleScopeInput({required this.branchId, required this.role});

  factory RoleScopeInput.fromJson(Map<String, Object?> json) =>
      _$RoleScopeInputFromJson(json);

  @JsonKey(includeIfNull: true)
  final String? branchId;
  final SessionRole role;

  Map<String, Object?> toJson() => _$RoleScopeInputToJson(this);
}
