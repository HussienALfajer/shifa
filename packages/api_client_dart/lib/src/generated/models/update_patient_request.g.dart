// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_patient_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdatePatientRequest _$UpdatePatientRequestFromJson(
  Map<String, dynamic> json,
) => UpdatePatientRequest(
  expectedUpdatedAt: DateTime.parse(json['expectedUpdatedAt'] as String),
  acknowledgedCandidateIds: (json['acknowledgedCandidateIds'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  age: json['age'] == null
      ? null
      : PatientAge.fromJson(json['age'] as Map<String, dynamic>),
  birthDate: json['birthDate'] as String?,
  contactPhone: json['contactPhone'] as String?,
  familyName: json['familyName'] as String?,
  fatherName: json['fatherName'] as String?,
  givenName: json['givenName'] as String?,
  motherName: json['motherName'] as String?,
  previousFileNumber: json['previousFileNumber'] as String?,
  relation: $enumDecodeNullable(_$PatientRelationEnumMap, json['relation']),
  secondPhone: json['secondPhone'] as String?,
  sex: $enumDecodeNullable(_$SexEnumMap, json['sex']),
  treatingDoctorIds: (json['treatingDoctorIds'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
);

Map<String, dynamic> _$UpdatePatientRequestToJson(
  UpdatePatientRequest instance,
) => <String, dynamic>{
  'acknowledgedCandidateIds': ?instance.acknowledgedCandidateIds,
  'age': ?instance.age,
  'birthDate': ?instance.birthDate,
  'contactPhone': ?instance.contactPhone,
  'expectedUpdatedAt': instance.expectedUpdatedAt.toIso8601String(),
  'familyName': ?instance.familyName,
  'fatherName': ?instance.fatherName,
  'givenName': ?instance.givenName,
  'motherName': ?instance.motherName,
  'previousFileNumber': ?instance.previousFileNumber,
  'relation': ?instance.relation,
  'secondPhone': ?instance.secondPhone,
  'sex': ?instance.sex,
  'treatingDoctorIds': ?instance.treatingDoctorIds,
};

const _$PatientRelationEnumMap = {
  PatientRelation.holder: 'holder',
  PatientRelation.son: 'son',
  PatientRelation.daughter: 'daughter',
  PatientRelation.husband: 'husband',
  PatientRelation.wife: 'wife',
  PatientRelation.father: 'father',
  PatientRelation.mother: 'mother',
  PatientRelation.brother: 'brother',
  PatientRelation.sister: 'sister',
  PatientRelation.other: 'other',
};

const _$SexEnumMap = {Sex.male: 'male', Sex.female: 'female'};
