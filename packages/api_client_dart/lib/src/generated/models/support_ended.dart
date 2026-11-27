// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'support_ended_by.dart';

part 'support_ended.g.dart';

@JsonSerializable()
class SupportEnded {
  const SupportEnded({
    required this.endedAt,
    required this.endedBy,
    required this.ownerName,
  });

  factory SupportEnded.fromJson(Map<String, Object?> json) =>
      _$SupportEndedFromJson(json);

  final DateTime endedAt;
  final SupportEndedBy endedBy;
  @JsonKey(includeIfNull: true)
  final String? ownerName;

  Map<String, Object?> toJson() => _$SupportEndedToJson(this);
}
