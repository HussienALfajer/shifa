// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'override_state.g.dart';

@JsonSerializable()
class OverrideState {
  const OverrideState({required this.expiresAt, required this.value});

  factory OverrideState.fromJson(Map<String, Object?> json) =>
      _$OverrideStateFromJson(json);

  @JsonKey(includeIfNull: true)
  final String? expiresAt;
  final dynamic value;

  Map<String, Object?> toJson() => _$OverrideStateToJson(this);
}
