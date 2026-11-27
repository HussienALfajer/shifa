// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'patient_count.g.dart';

@JsonSerializable()
class PatientCount {
  const PatientCount({required this.active, required this.archived});

  factory PatientCount.fromJson(Map<String, Object?> json) =>
      _$PatientCountFromJson(json);

  final int active;
  final int archived;

  Map<String, Object?> toJson() => _$PatientCountToJson(this);
}
