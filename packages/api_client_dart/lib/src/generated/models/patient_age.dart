// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'age_unit.dart';

part 'patient_age.g.dart';

@JsonSerializable()
class PatientAge {
  const PatientAge({required this.unit, required this.value});

  factory PatientAge.fromJson(Map<String, Object?> json) =>
      _$PatientAgeFromJson(json);

  final AgeUnit unit;
  final int value;

  Map<String, Object?> toJson() => _$PatientAgeToJson(this);
}
