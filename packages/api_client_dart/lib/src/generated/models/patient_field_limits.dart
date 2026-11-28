// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'patient_field_limits.g.dart';

@JsonSerializable()
class PatientFieldLimits {
  const PatientFieldLimits({
    required this.max,
    required this.searchableMax,
    required this.searchableUsed,
    required this.used,
  });

  factory PatientFieldLimits.fromJson(Map<String, Object?> json) =>
      _$PatientFieldLimitsFromJson(json);

  final int max;
  final int searchableMax;
  final int searchableUsed;
  final int used;

  Map<String, Object?> toJson() => _$PatientFieldLimitsToJson(this);
}
