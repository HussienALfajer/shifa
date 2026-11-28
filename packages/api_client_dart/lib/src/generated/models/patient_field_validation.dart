// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_field_pattern.dart';

part 'patient_field_validation.g.dart';

@JsonSerializable()
class PatientFieldValidation {
  const PatientFieldValidation({
    required this.max,
    required this.maxLength,
    required this.min,
    required this.minLength,
    required this.pattern,
  });

  factory PatientFieldValidation.fromJson(Map<String, Object?> json) =>
      _$PatientFieldValidationFromJson(json);

  @JsonKey(includeIfNull: true)
  final num? max;
  @JsonKey(includeIfNull: true)
  final int? maxLength;
  @JsonKey(includeIfNull: true)
  final num? min;
  @JsonKey(includeIfNull: true)
  final int? minLength;
  @JsonKey(includeIfNull: true)
  final PatientFieldPattern? pattern;

  Map<String, Object?> toJson() => _$PatientFieldValidationToJson(this);
}
