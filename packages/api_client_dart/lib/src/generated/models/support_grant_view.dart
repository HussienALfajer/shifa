// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'support_ended_by.dart';

part 'support_grant_view.g.dart';

@JsonSerializable()
class SupportGrantView {
  const SupportGrantView({
    required this.adminName,
    required this.endedAt,
    required this.endedBy,
    required this.endedByName,
    required this.expiresAt,
    required this.id,
    required this.reason,
    required this.startedAt,
  });

  factory SupportGrantView.fromJson(Map<String, Object?> json) =>
      _$SupportGrantViewFromJson(json);

  final String adminName;
  @JsonKey(includeIfNull: true)
  final DateTime? endedAt;
  @JsonKey(includeIfNull: true)
  final SupportEndedBy? endedBy;
  @JsonKey(includeIfNull: true)
  final String? endedByName;
  final DateTime expiresAt;
  final String id;
  final String reason;
  final DateTime startedAt;

  Map<String, Object?> toJson() => _$SupportGrantViewToJson(this);
}
