// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'patient_branch.g.dart';

@JsonSerializable()
class PatientBranch {
  const PatientBranch({required this.id, required this.name});

  factory PatientBranch.fromJson(Map<String, Object?> json) =>
      _$PatientBranchFromJson(json);

  final String id;
  final String name;

  Map<String, Object?> toJson() => _$PatientBranchToJson(this);
}
