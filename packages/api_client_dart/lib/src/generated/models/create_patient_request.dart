// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_age.dart';
import 'patient_field_values.dart';
import 'patient_relation.dart';
import 'sex.dart';

part 'create_patient_request.g.dart';

@JsonSerializable()
class CreatePatientRequest {
  const CreatePatientRequest({
    required this.contactPhone,
    required this.givenName,
    required this.id,
    required this.sex,
    this.acknowledgedCandidateIds,
    this.age,
    this.birthDate,
    this.familyName,
    this.fatherName,
    this.fields,
    this.motherName,
    this.previousFileNumber,
    this.relation,
    this.secondPhone,
    this.treatingDoctorIds,
  });

  factory CreatePatientRequest.fromJson(Map<String, Object?> json) =>
      _$CreatePatientRequestFromJson(json);

  @JsonKey(includeIfNull: false)
  final List<String>? acknowledgedCandidateIds;
  @JsonKey(includeIfNull: false)
  final PatientAge? age;
  @JsonKey(includeIfNull: false)
  final String? birthDate;
  final String contactPhone;
  @JsonKey(includeIfNull: false)
  final String? familyName;
  @JsonKey(includeIfNull: false)
  final String? fatherName;
  @JsonKey(includeIfNull: false)
  final PatientFieldValues? fields;
  final String givenName;
  final String id;
  @JsonKey(includeIfNull: false)
  final String? motherName;
  @JsonKey(includeIfNull: false)
  final String? previousFileNumber;
  @JsonKey(includeIfNull: false)
  final PatientRelation? relation;
  @JsonKey(includeIfNull: false)
  final String? secondPhone;
  final Sex sex;
  @JsonKey(includeIfNull: false)
  final List<String>? treatingDoctorIds;

  Map<String, Object?> toJson() => _$CreatePatientRequestToJson(this);
}
