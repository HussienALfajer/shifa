// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_field_definition.dart';
import 'patient_field_limits.dart';

part 'patient_field_definitions.g.dart';

@JsonSerializable()
class PatientFieldDefinitions {
  const PatientFieldDefinitions({
    required this.fields,
    required this.limits,
    required this.listUpdatedAt,
  });

  factory PatientFieldDefinitions.fromJson(Map<String, Object?> json) =>
      _$PatientFieldDefinitionsFromJson(json);

  final List<PatientFieldDefinition> fields;
  final PatientFieldLimits limits;
  @JsonKey(includeIfNull: true)
  final DateTime? listUpdatedAt;

  Map<String, Object?> toJson() => _$PatientFieldDefinitionsToJson(this);
}
