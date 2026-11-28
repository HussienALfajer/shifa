// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_age.dart';
import 'patient_field_values.dart';
import 'patient_relation.dart';
import 'sex.dart';

part 'update_patient_request.g.dart';

@JsonSerializable()
class UpdatePatientRequest {
  const UpdatePatientRequest({
    required this.expectedUpdatedAt,
    this.acknowledgedCandidateIds,
    this.age,
    this.birthDate,
    this.contactPhone,
    this.familyName,
    this.fatherName,
    this.fields,
    this.givenName,
    this.motherName,
    this.previousFileNumber,
    this.relation,
    this.secondPhone,
    this.sex,
    this.treatingDoctorIds,
  });

  factory UpdatePatientRequest.fromJson(Map<String, Object?> json) =>
      _$UpdatePatientRequestFromJson(json);

  @JsonKey(includeIfNull: false)
  final List<String>? acknowledgedCandidateIds;
  @JsonKey(includeIfNull: false)
  final PatientAge? age;
  @JsonKey(includeIfNull: false)
  final String? birthDate;
  @JsonKey(includeIfNull: false)
  final String? contactPhone;
  final DateTime expectedUpdatedAt;
  @JsonKey(includeIfNull: false)
  final String? familyName;
  @JsonKey(includeIfNull: false)
  final String? fatherName;
  @JsonKey(includeIfNull: false)
  final PatientFieldValues? fields;
  @JsonKey(includeIfNull: false)
  final String? givenName;
  @JsonKey(includeIfNull: false)
  final String? motherName;
  @JsonKey(includeIfNull: false)
  final String? previousFileNumber;
  @JsonKey(includeIfNull: false)
  final PatientRelation? relation;
  @JsonKey(includeIfNull: false)
  final String? secondPhone;
  @JsonKey(includeIfNull: false)
  final Sex? sex;
  @JsonKey(includeIfNull: false)
  final List<String>? treatingDoctorIds;

  Map<String, Object?> toJson() => _$UpdatePatientRequestToJson(this);
}
