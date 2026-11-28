// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_field_pattern.dart';

part 'patient_field_validation_input.g.dart';

@JsonSerializable()
class PatientFieldValidationInput {
  const PatientFieldValidationInput({
    this.max,
    this.maxLength,
    this.min,
    this.minLength,
    this.pattern,
  });

  factory PatientFieldValidationInput.fromJson(Map<String, Object?> json) =>
      _$PatientFieldValidationInputFromJson(json);

  @JsonKey(includeIfNull: false)
  final num? max;
  @JsonKey(includeIfNull: false)
  final int? maxLength;
  @JsonKey(includeIfNull: false)
  final num? min;
  @JsonKey(includeIfNull: false)
  final int? minLength;
  @JsonKey(includeIfNull: false)
  final PatientFieldPattern? pattern;

  Map<String, Object?> toJson() => _$PatientFieldValidationInputToJson(this);
}
