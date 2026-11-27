// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'override_event_kind.dart';
import 'override_state.dart';

part 'override_event.g.dart';

@JsonSerializable()
class OverrideEvent {
  const OverrideEvent({
    required this.after,
    required this.at,
    required this.before,
    required this.byName,
    required this.kind,
    required this.reason,
  });

  factory OverrideEvent.fromJson(Map<String, Object?> json) =>
      _$OverrideEventFromJson(json);

  @JsonKey(includeIfNull: true)
  final OverrideState? after;
  final DateTime at;
  @JsonKey(includeIfNull: true)
  final OverrideState? before;
  @JsonKey(includeIfNull: true)
  final String? byName;
  final OverrideEventKind kind;
  @JsonKey(includeIfNull: true)
  final String? reason;

  Map<String, Object?> toJson() => _$OverrideEventToJson(this);
}
