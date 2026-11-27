// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'stale_change.g.dart';

@JsonSerializable()
class StaleChange {
  const StaleChange({required this.updatedAt, required this.updatedByName});

  factory StaleChange.fromJson(Map<String, Object?> json) =>
      _$StaleChangeFromJson(json);

  final DateTime updatedAt;
  @JsonKey(includeIfNull: true)
  final String? updatedByName;

  Map<String, Object?> toJson() => _$StaleChangeToJson(this);
}
