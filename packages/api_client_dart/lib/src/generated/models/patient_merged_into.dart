// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'patient_merged_into.g.dart';

@JsonSerializable()
class PatientMergedInto {
  const PatientMergedInto({required this.fileNumber, required this.id});

  factory PatientMergedInto.fromJson(Map<String, Object?> json) =>
      _$PatientMergedIntoFromJson(json);

  final int fileNumber;
  final String id;

  Map<String, Object?> toJson() => _$PatientMergedIntoToJson(this);
}
