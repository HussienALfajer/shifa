// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_field_pattern_preset.dart';

part 'patient_field_pattern.g.dart';

@JsonSerializable()
class PatientFieldPattern {
  const PatientFieldPattern({required this.expression, required this.preset});

  factory PatientFieldPattern.fromJson(Map<String, Object?> json) =>
      _$PatientFieldPatternFromJson(json);

  @JsonKey(includeIfNull: true)
  final String? expression;
  final PatientFieldPatternPreset preset;

  Map<String, Object?> toJson() => _$PatientFieldPatternToJson(this);
}
