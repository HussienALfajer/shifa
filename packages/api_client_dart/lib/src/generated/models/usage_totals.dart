// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'usage_totals.g.dart';

@JsonSerializable()
class UsageTotals {
  const UsageTotals({required this.membersSignedIn, required this.signIns});

  factory UsageTotals.fromJson(Map<String, Object?> json) =>
      _$UsageTotalsFromJson(json);

  final int membersSignedIn;
  final int signIns;

  Map<String, Object?> toJson() => _$UsageTotalsToJson(this);
}
