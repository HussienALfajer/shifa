// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'override_event.dart';

part 'override_history.g.dart';

@JsonSerializable()
class OverrideHistory {
  const OverrideHistory({required this.events});

  factory OverrideHistory.fromJson(Map<String, Object?> json) =>
      _$OverrideHistoryFromJson(json);

  final List<OverrideEvent> events;

  Map<String, Object?> toJson() => _$OverrideHistoryToJson(this);
}
