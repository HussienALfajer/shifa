// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'usage_day.dart';
import 'usage_today_counts.dart';
import 'usage_totals.dart';

part 'clinic_usage.g.dart';

@JsonSerializable()
class ClinicUsage {
  const ClinicUsage({
    required this.branches,
    required this.days,
    required this.hasData,
    required this.lastActivityAt,
    required this.members,
    required this.previousTotals,
    required this.today,
    required this.todayCounts,
  });

  factory ClinicUsage.fromJson(Map<String, Object?> json) =>
      _$ClinicUsageFromJson(json);

  final int branches;
  final List<UsageDay> days;
  final bool hasData;
  @JsonKey(includeIfNull: true)
  final DateTime? lastActivityAt;
  final int members;
  final UsageTotals previousTotals;
  final String today;
  final UsageTodayCounts todayCounts;

  Map<String, Object?> toJson() => _$ClinicUsageToJson(this);
}
