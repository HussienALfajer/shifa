// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'family_member.dart';
import 'patient_branch.dart';
import 'patient_merged_into.dart';
import 'patient_relation.dart';
import 'patient_state.dart';
import 'sex.dart';
import 'treating_doctor.dart';

part 'patient_chart.g.dart';

@JsonSerializable()
class PatientChart {
  const PatientChart({
    required this.archivedAt,
    required this.archivedByName,
    required this.birthDate,
    required this.birthDateEstimated,
    required this.contactPhone,
    required this.createdAt,
    required this.createdByName,
    required this.displayName,
    required this.family,
    required this.familyName,
    required this.fatherName,
    required this.fileNumber,
    required this.givenName,
    required this.id,
    required this.mergedInto,
    required this.motherName,
    required this.previousFileNumber,
    required this.registeredBranch,
    required this.relation,
    required this.secondPhone,
    required this.sex,
    required this.state,
    required this.treatingDoctors,
    required this.updatedAt,
    required this.updatedByName,
  });

  factory PatientChart.fromJson(Map<String, Object?> json) =>
      _$PatientChartFromJson(json);

  @JsonKey(includeIfNull: true)
  final DateTime? archivedAt;
  @JsonKey(includeIfNull: true)
  final String? archivedByName;
  final String birthDate;
  final bool birthDateEstimated;
  final String contactPhone;
  final DateTime createdAt;
  @JsonKey(includeIfNull: true)
  final String? createdByName;
  final String displayName;
  final List<FamilyMember> family;
  @JsonKey(includeIfNull: true)
  final String? familyName;
  @JsonKey(includeIfNull: true)
  final String? fatherName;
  final int fileNumber;
  final String givenName;
  final String id;
  @JsonKey(includeIfNull: true)
  final PatientMergedInto? mergedInto;
  @JsonKey(includeIfNull: true)
  final String? motherName;
  @JsonKey(includeIfNull: true)
  final String? previousFileNumber;
  @JsonKey(includeIfNull: true)
  final PatientBranch? registeredBranch;
  @JsonKey(includeIfNull: true)
  final PatientRelation? relation;
  @JsonKey(includeIfNull: true)
  final String? secondPhone;
  final Sex sex;
  final PatientState state;
  final List<TreatingDoctor> treatingDoctors;
  final DateTime updatedAt;
  @JsonKey(includeIfNull: true)
  final String? updatedByName;

  Map<String, Object?> toJson() => _$PatientChartToJson(this);
}
