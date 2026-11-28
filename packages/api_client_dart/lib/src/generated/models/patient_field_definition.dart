// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_field_key.dart';
import 'patient_field_option.dart';
import 'patient_field_state.dart';
import 'patient_field_type.dart';
import 'patient_field_validation.dart';
import 'session_role.dart';

part 'patient_field_definition.g.dart';

@JsonSerializable()
class PatientFieldDefinition {
  const PatientFieldDefinition({
    required this.archivedAt,
    required this.chartCount,
    required this.createdAt,
    required this.defaultValue,
    required this.editRoles,
    required this.key,
    required this.label,
    required this.labelEn,
    required this.options,
    required this.order,
    required this.print,
    required this.purgeAt,
    required this.requiredValue,
    required this.searchable,
    required this.section,
    required this.sensitive,
    required this.state,
    required this.type,
    required this.updatedAt,
    required this.validation,
    required this.viewRoles,
  });

  factory PatientFieldDefinition.fromJson(Map<String, Object?> json) =>
      _$PatientFieldDefinitionFromJson(json);

  @JsonKey(includeIfNull: true)
  final DateTime? archivedAt;
  final int chartCount;
  final DateTime createdAt;

  /// The name has been replaced because it contains a keyword. Original name: `default`.
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  @JsonKey(includeIfNull: true, name: 'default')
  final dynamic defaultValue;
  final List<SessionRole> editRoles;
  final PatientFieldKey key;
  final String label;
  @JsonKey(includeIfNull: true)
  final String? labelEn;
  final List<PatientFieldOption> options;
  final int order;
  final bool print;
  @JsonKey(includeIfNull: true)
  final DateTime? purgeAt;

  /// The name has been replaced because it contains a keyword. Original name: `required`.
  @JsonKey(name: 'required')
  final bool requiredValue;
  final bool searchable;
  final String section;
  final bool sensitive;
  final PatientFieldState state;
  final PatientFieldType type;
  final DateTime updatedAt;
  final PatientFieldValidation validation;
  final List<SessionRole> viewRoles;

  Map<String, Object?> toJson() => _$PatientFieldDefinitionToJson(this);
}
