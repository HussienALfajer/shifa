// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'patient_field_option_input.g.dart';

@JsonSerializable()
class PatientFieldOptionInput {
  const PatientFieldOptionInput({required this.label, this.archived, this.id});

  factory PatientFieldOptionInput.fromJson(Map<String, Object?> json) =>
      _$PatientFieldOptionInputFromJson(json);

  @JsonKey(includeIfNull: false)
  final bool? archived;
  @JsonKey(includeIfNull: false)
  final String? id;
  final String label;

  Map<String, Object?> toJson() => _$PatientFieldOptionInputToJson(this);
}
