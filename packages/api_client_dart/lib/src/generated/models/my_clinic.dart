// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'clinic_status.dart';
import 'my_branch.dart';
import 'session_role.dart';

part 'my_clinic.g.dart';

@JsonSerializable()
class MyClinic {
  const MyClinic({
    required this.branches,
    required this.lastActiveAt,
    required this.name,
    required this.roles,
    required this.selectable,
    required this.solo,
    required this.status,
    required this.tenantId,
  });

  factory MyClinic.fromJson(Map<String, Object?> json) =>
      _$MyClinicFromJson(json);

  final List<MyBranch> branches;
  @JsonKey(includeIfNull: true)
  final DateTime? lastActiveAt;
  final String name;
  final List<SessionRole> roles;
  final bool selectable;
  final bool solo;
  final ClinicStatus status;
  final String tenantId;

  Map<String, Object?> toJson() => _$MyClinicToJson(this);
}
