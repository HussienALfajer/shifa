// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_field_option_input.dart';
import 'patient_field_type.dart';
import 'patient_field_validation_input.dart';
import 'session_role.dart';

part 'update_patient_field_request.g.dart';

@JsonSerializable()
class UpdatePatientFieldRequest {
  const UpdatePatientFieldRequest({
    required this.expectedUpdatedAt,
    this.defaultValue,
    this.editRoles,
    this.label,
    this.labelEn,
    this.options,
    this.print,
    this.requiredValue,
    this.searchable,
    this.section,
    this.sensitive,
    this.type,
    this.validation,
    this.viewRoles,
  });

  factory UpdatePatientFieldRequest.fromJson(Map<String, Object?> json) =>
      _$UpdatePatientFieldRequestFromJson(json);

  /// The name has been replaced because it contains a keyword. Original name: `default`.
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  @JsonKey(includeIfNull: false, name: 'default')
  final dynamic defaultValue;
  @JsonKey(includeIfNull: false)
  final List<SessionRole>? editRoles;
  final DateTime expectedUpdatedAt;
  @JsonKey(includeIfNull: false)
  final String? label;
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
  @JsonKey(includeIfNull: false)
  final String? section;
  @JsonKey(includeIfNull: false)
  final bool? sensitive;
  @JsonKey(includeIfNull: false)
  final PatientFieldType? type;
  @JsonKey(includeIfNull: false)
  final PatientFieldValidationInput? validation;
  @JsonKey(includeIfNull: false)
  final List<SessionRole>? viewRoles;

  Map<String, Object?> toJson() => _$UpdatePatientFieldRequestToJson(this);
}
