// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'session_summary.g.dart';

@JsonSerializable()
class SessionSummary {
  const SessionSummary({
    required this.browser,
    required this.createdAt,
    required this.current,
    required this.device,
    required this.id,
    required this.lastActiveAt,
  });

  factory SessionSummary.fromJson(Map<String, Object?> json) =>
      _$SessionSummaryFromJson(json);

  @JsonKey(includeIfNull: true)
  final String? browser;
  final DateTime createdAt;
  final bool current;
  @JsonKey(includeIfNull: true)
  final String? device;
  final String id;
  final DateTime lastActiveAt;

  Map<String, Object?> toJson() => _$SessionSummaryToJson(this);
}
