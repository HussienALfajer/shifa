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
  age: json['age'] == null
      ? null
      : PatientAge.fromJson(json['age'] as Map<String, dynamic>),
  birthDate: json['birthDate'] as String?,
  familyName: json['familyName'] as String?,
  fatherName: json['fatherName'] as String?,
  motherName: json['motherName'] as String?,
  previousFileNumber: json['previousFileNumber'] as String?,
  secondPhone: json['secondPhone'] as String?,
);

Map<String, dynamic> _$CreatePatientRequestToJson(
  CreatePatientRequest instance,
) => <String, dynamic>{
  'age': ?instance.age,
  'birthDate': ?instance.birthDate,
  'contactPhone': instance.contactPhone,
  'familyName': ?instance.familyName,
  'fatherName': ?instance.fatherName,
  'givenName': instance.givenName,
  'id': instance.id,
  'motherName': ?instance.motherName,
  'previousFileNumber': ?instance.previousFileNumber,
  'secondPhone': ?instance.secondPhone,
  'sex': instance.sex,
};

const _$SexEnumMap = {Sex.male: 'male', Sex.female: 'female'};
