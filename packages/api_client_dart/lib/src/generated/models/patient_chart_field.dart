// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_chart_field_option.dart';
import 'patient_field_key.dart';
import 'patient_field_type.dart';

part 'patient_chart_field.g.dart';

@JsonSerializable()
class PatientChartField {
  const PatientChartField({
    required this.key,
    required this.label,
    required this.options,
    required this.order,
    required this.section,
    required this.sensitive,
    required this.type,
    required this.value,
  });

  factory PatientChartField.fromJson(Map<String, Object?> json) =>
      _$PatientChartFieldFromJson(json);

  final PatientFieldKey key;
  final String label;
  final List<PatientChartFieldOption> options;
  final int order;
  final String section;
  final bool sensitive;
  final PatientFieldType type;
  @JsonKey(includeIfNull: true)
  final dynamic value;

  Map<String, Object?> toJson() => _$PatientChartFieldToJson(this);
}
