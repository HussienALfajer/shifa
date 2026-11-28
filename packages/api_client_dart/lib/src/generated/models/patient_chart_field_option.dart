// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'patient_chart_field_option.g.dart';

@JsonSerializable()
class PatientChartFieldOption {
  const PatientChartFieldOption({
    required this.archived,
    required this.id,
    required this.label,
  });

  factory PatientChartFieldOption.fromJson(Map<String, Object?> json) =>
      _$PatientChartFieldOptionFromJson(json);

  final bool archived;
  final String id;
  final String label;

  Map<String, Object?> toJson() => _$PatientChartFieldOptionToJson(this);
}
