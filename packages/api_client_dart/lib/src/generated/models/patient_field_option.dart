// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'patient_field_option.g.dart';

@JsonSerializable()
class PatientFieldOption {
  const PatientFieldOption({
    required this.archived,
    required this.chartCount,
    required this.id,
    required this.label,
    required this.order,
  });

  factory PatientFieldOption.fromJson(Map<String, Object?> json) =>
      _$PatientFieldOptionFromJson(json);

  final bool archived;
  final int chartCount;
  final String id;
  final String label;
  final int order;

  Map<String, Object?> toJson() => _$PatientFieldOptionToJson(this);
}
