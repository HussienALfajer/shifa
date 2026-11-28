// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'patient_form_field_option.g.dart';

@JsonSerializable()
class PatientFormFieldOption {
  const PatientFormFieldOption({required this.id, required this.label});

  factory PatientFormFieldOption.fromJson(Map<String, Object?> json) =>
      _$PatientFormFieldOptionFromJson(json);

  final String id;
  final String label;

  Map<String, Object?> toJson() => _$PatientFormFieldOptionToJson(this);
}
