// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'role_scope_input.dart';

part 'add_member_request.g.dart';

@JsonSerializable()
class AddMemberRequest {
  const AddMemberRequest({
    required this.name,
    required this.phone,
    required this.roles,
  });

  factory AddMemberRequest.fromJson(Map<String, Object?> json) =>
      _$AddMemberRequestFromJson(json);

  final String name;
  final String phone;
  final List<RoleScopeInput> roles;

  Map<String, Object?> toJson() => _$AddMemberRequestToJson(this);
}
