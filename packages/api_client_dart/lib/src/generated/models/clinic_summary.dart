// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'clinic_status.dart';
import 'clinic_type.dart';
import 'membership_status.dart';

part 'clinic_summary.g.dart';

@JsonSerializable()
class ClinicSummary {
  const ClinicSummary({
    required this.createdAt,
    required this.id,
    required this.lastActivityAt,
    required this.name,
    required this.ownerName,
    required this.ownerStatus,
    required this.signIns7d,
    required this.status,
    required this.subscriptionEnd,
    required this.type,
  });

  factory ClinicSummary.fromJson(Map<String, Object?> json) =>
      _$ClinicSummaryFromJson(json);

  final DateTime createdAt;
  final String id;
  @JsonKey(includeIfNull: true)
  final DateTime? lastActivityAt;
  final String name;
  @JsonKey(includeIfNull: true)
  final String? ownerName;
  @JsonKey(includeIfNull: true)
  final MembershipStatus? ownerStatus;
  final int signIns7d;
  final ClinicStatus status;
  @JsonKey(includeIfNull: true)
  final String? subscriptionEnd;
  final ClinicType type;

  Map<String, Object?> toJson() => _$ClinicSummaryToJson(this);
}
