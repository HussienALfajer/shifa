// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_field_option_input.dart';
import 'patient_field_type.dart';
import 'patient_field_validation_input.dart';
import 'session_role.dart';

part 'create_patient_field_request.g.dart';

@JsonSerializable()
class CreatePatientFieldRequest {
  const CreatePatientFieldRequest({
    required this.label,
    required this.section,
    required this.type,
    required this.viewRoles,
    this.defaultValue,
    this.editRoles,
    this.labelEn,
    this.options,
    this.print,
    this.requiredValue,
    this.searchable,
    this.sensitive,
    this.validation,
  });

  factory CreatePatientFieldRequest.fromJson(Map<String, Object?> json) =>
      _$CreatePatientFieldRequestFromJson(json);

  /// The name has been replaced because it contains a keyword. Original name: `default`.
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  @JsonKey(includeIfNull: false, name: 'default')
  final dynamic defaultValue;
  @JsonKey(includeIfNull: false)
  final List<SessionRole>? editRoles;
  final String label;
  @JsonKey(includeIfNull: false)
  final String? labelEn;
  @JsonKey(includeIfNull: false)
  final List<PatientFieldOptionInput>? options;
  @JsonKey(includeIfNull: false)
  final bool? print;

  /// The name has been replaced because it contains a keyword. Original name: `required`.
  @JsonKey(includeIfNull: false, name: 'required')
  final bool? requiredValue;
  @JsonKey(includeIfNull: false)
  final bool? searchable;
  final String section;
  @JsonKey(includeIfNull: false)
  final bool? sensitive;
  final PatientFieldType type;
  @JsonKey(includeIfNull: false)
  final PatientFieldValidationInput? validation;
  final List<SessionRole> viewRoles;

  Map<String, Object?> toJson() => _$CreatePatientFieldRequestToJson(this);
}
