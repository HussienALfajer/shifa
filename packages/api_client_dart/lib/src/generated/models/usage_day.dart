// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'usage_day.g.dart';

@JsonSerializable()
class UsageDay {
  const UsageDay({
    required this.date,
    required this.membersSignedIn,
    required this.signIns,
  });

  factory UsageDay.fromJson(Map<String, Object?> json) =>
      _$UsageDayFromJson(json);

  final String date;
  final int membersSignedIn;
  final int signIns;

  Map<String, Object?> toJson() => _$UsageDayToJson(this);
}
