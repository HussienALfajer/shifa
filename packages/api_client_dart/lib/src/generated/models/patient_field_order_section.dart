// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_field_key.dart';

part 'patient_field_order_section.g.dart';

@JsonSerializable()
class PatientFieldOrderSection {
  const PatientFieldOrderSection({required this.keys, required this.title});

  factory PatientFieldOrderSection.fromJson(Map<String, Object?> json) =>
      _$PatientFieldOrderSectionFromJson(json);

  final List<PatientFieldKey> keys;
  final String title;

  Map<String, Object?> toJson() => _$PatientFieldOrderSectionToJson(this);
}
