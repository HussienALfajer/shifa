// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'member_role.dart';
import 'membership_status.dart';

part 'member_summary.g.dart';

@JsonSerializable()
class MemberSummary {
  const MemberSummary({
    required this.id,
    required this.isSelf,
    required this.lastActiveAt,
    required this.linkExpiresAt,
    required this.name,
    required this.phone,
    required this.roles,
    required this.status,
  });

  factory MemberSummary.fromJson(Map<String, Object?> json) =>
      _$MemberSummaryFromJson(json);

  final String id;
  final bool isSelf;
  @JsonKey(includeIfNull: true)
  final DateTime? lastActiveAt;
  @JsonKey(includeIfNull: true)
  final DateTime? linkExpiresAt;
  final String name;
  final String phone;
  final List<MemberRole> roles;
  final MembershipStatus status;

  Map<String, Object?> toJson() => _$MemberSummaryToJson(this);
}
