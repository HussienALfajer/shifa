// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'support_handoff.g.dart';

@JsonSerializable()
class SupportHandoff {
  const SupportHandoff({required this.handoffUrl});

  factory SupportHandoff.fromJson(Map<String, Object?> json) =>
      _$SupportHandoffFromJson(json);

  final String handoffUrl;

  Map<String, Object?> toJson() => _$SupportHandoffToJson(this);
}
