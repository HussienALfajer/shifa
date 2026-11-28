// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_field_key.dart';
import 'patient_field_type.dart';
import 'patient_field_validation.dart';
import 'patient_form_field_option.dart';

part 'patient_form_field.g.dart';

@JsonSerializable()
class PatientFormField {
  const PatientFormField({
    required this.defaultValue,
    required this.editable,
    required this.key,
    required this.label,
    required this.options,
    required this.order,
    required this.requiredValue,
    required this.section,
    required this.sensitive,
    required this.type,
    required this.validation,
  });

  factory PatientFormField.fromJson(Map<String, Object?> json) =>
      _$PatientFormFieldFromJson(json);

  /// The name has been replaced because it contains a keyword. Original name: `default`.
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  @JsonKey(includeIfNull: true, name: 'default')
  final dynamic defaultValue;
  final bool editable;
  final PatientFieldKey key;
  final String label;
  final List<PatientFormFieldOption> options;
  final int order;

  /// The name has been replaced because it contains a keyword. Original name: `required`.
  @JsonKey(name: 'required')
  final bool requiredValue;
  final String section;
  final bool sensitive;
  final PatientFieldType type;
  final PatientFieldValidation validation;

  Map<String, Object?> toJson() => _$PatientFormFieldToJson(this);
}
