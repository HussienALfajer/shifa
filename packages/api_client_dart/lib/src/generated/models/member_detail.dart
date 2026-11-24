// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'member_permission.dart';
import 'member_role.dart';
import 'membership_status.dart';

part 'member_detail.g.dart';

@JsonSerializable()
class MemberDetail {
  const MemberDetail({
    required this.id,
    required this.isLastOwner,
    required this.lastActiveAt,
    required this.mfaEnrolled,
    required this.name,
    required this.permissions,
    required this.phone,
    required this.roles,
    required this.status,
  });

  factory MemberDetail.fromJson(Map<String, Object?> json) =>
      _$MemberDetailFromJson(json);

  final String id;
  final bool isLastOwner;
  @JsonKey(includeIfNull: true)
  final DateTime? lastActiveAt;
  final bool mfaEnrolled;
  final String name;
  final List<MemberPermission> permissions;
  final String phone;
  final List<MemberRole> roles;
  final MembershipStatus status;

  Map<String, Object?> toJson() => _$MemberDetailToJson(this);
}
