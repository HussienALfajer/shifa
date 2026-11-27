// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'usage_today_counts.g.dart';

@JsonSerializable()
class UsageTodayCounts {
  const UsageTodayCounts({
    required this.activeBranches,
    required this.activeMembers,
    required this.membersSignedIn,
    required this.signIns,
  });

  factory UsageTodayCounts.fromJson(Map<String, Object?> json) =>
      _$UsageTodayCountsFromJson(json);

  final int activeBranches;
  final int activeMembers;
  final int membersSignedIn;
  final int signIns;

  Map<String, Object?> toJson() => _$UsageTodayCountsToJson(this);
}
