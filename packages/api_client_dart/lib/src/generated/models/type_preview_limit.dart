// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'type_preview_limit.g.dart';

@JsonSerializable()
class TypePreviewLimit {
  const TypePreviewLimit({
    required this.current,
    required this.key,
    required this.next,
    required this.over,
    required this.used,
  });

  factory TypePreviewLimit.fromJson(Map<String, Object?> json) =>
      _$TypePreviewLimitFromJson(json);

  final num current;
  final String key;
  final num next;
  final bool over;
  final num used;

  Map<String, Object?> toJson() => _$TypePreviewLimitToJson(this);
}
