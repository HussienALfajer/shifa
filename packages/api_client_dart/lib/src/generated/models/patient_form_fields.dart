// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_form_field.dart';

part 'patient_form_fields.g.dart';

@JsonSerializable()
class PatientFormFields {
  const PatientFormFields({required this.fields});

  factory PatientFormFields.fromJson(Map<String, Object?> json) =>
      _$PatientFormFieldsFromJson(json);

  final List<PatientFormField> fields;

  Map<String, Object?> toJson() => _$PatientFormFieldsToJson(this);
}
