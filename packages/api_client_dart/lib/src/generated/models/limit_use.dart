// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'limit_use.g.dart';

@JsonSerializable()
class LimitUse {
  const LimitUse({required this.key, required this.limit, required this.used});

  factory LimitUse.fromJson(Map<String, Object?> json) =>
      _$LimitUseFromJson(json);

  final String key;
  final int limit;
  @JsonKey(includeIfNull: true)
  final int? used;

  Map<String, Object?> toJson() => _$LimitUseToJson(this);
}
