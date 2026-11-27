// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'limit_reached.g.dart';

@JsonSerializable()
class LimitReached {
  const LimitReached({
    required this.key,
    required this.limit,
    required this.used,
  });

  factory LimitReached.fromJson(Map<String, Object?> json) =>
      _$LimitReachedFromJson(json);

  final String key;
  final int limit;
  final int used;

  Map<String, Object?> toJson() => _$LimitReachedToJson(this);
}
