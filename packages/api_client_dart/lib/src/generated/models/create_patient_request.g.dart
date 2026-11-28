// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_patient_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreatePatientRequest _$CreatePatientRequestFromJson(
  Map<String, dynamic> json,
) => CreatePatientRequest(
  contactPhone: json['contactPhone'] as String,
  givenName: json['givenName'] as String,
  id: json['id'] as String,
  sex: $enumDecode(_$SexEnumMap, json['sex']),
  acknowledgedCandidateIds: (json['acknowledgedCandidateIds'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  age: json['age'] == null
      ? null
      : PatientAge.fromJson(json['age'] as Map<String, dynamic>),
  birthDate: json['birthDate'] as String?,
  familyName: json['familyName'] as String?,
  fatherName: json['fatherName'] as String?,
  fields: json['fields'] as Map<String, dynamic>?,
  motherName: json['motherName'] as String?,
  previousFileNumber: json['previousFileNumber'] as String?,
  relation: $enumDecodeNullable(_$PatientRelationEnumMap, json['relation']),
  secondPhone: json['secondPhone'] as String?,
  treatingDoctorIds: (json['treatingDoctorIds'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
);

Map<String, dynamic> _$CreatePatientRequestToJson(
  CreatePatientRequest instance,
) => <String, dynamic>{
  'acknowledgedCandidateIds': ?instance.acknowledgedCandidateIds,
  'age': ?instance.age,
  'birthDate': ?instance.birthDate,
  'contactPhone': instance.contactPhone,
  'familyName': ?instance.familyName,
  'fatherName': ?instance.fatherName,
  'fields': ?instance.fields,
  'givenName': instance.givenName,
  'id': instance.id,
  'motherName': ?instance.motherName,
  'previousFileNumber': ?instance.previousFileNumber,
  'relation': ?instance.relation,
  'secondPhone': ?instance.secondPhone,
  'sex': instance.sex,
  'treatingDoctorIds': ?instance.treatingDoctorIds,
};

const _$SexEnumMap = {Sex.male: 'male', Sex.female: 'female'};

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
