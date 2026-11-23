// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'clinic_summary.dart';

part 'clinic_list.g.dart';

@JsonSerializable()
class ClinicList {
  const ClinicList({required this.clinics});

  factory ClinicList.fromJson(Map<String, Object?> json) =>
      _$ClinicListFromJson(json);

  final List<ClinicSummary> clinics;

  Map<String, Object?> toJson() => _$ClinicListToJson(this);
}
