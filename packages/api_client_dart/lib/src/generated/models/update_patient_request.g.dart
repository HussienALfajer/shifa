// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_patient_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdatePatientRequest _$UpdatePatientRequestFromJson(
  Map<String, dynamic> json,
) => UpdatePatientRequest(
  expectedUpdatedAt: DateTime.parse(json['expectedUpdatedAt'] as String),
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
  secondPhone: json['secondPhone'] as String?,
  sex: $enumDecodeNullable(_$SexEnumMap, json['sex']),
);

Map<String, dynamic> _$UpdatePatientRequestToJson(
  UpdatePatientRequest instance,
) => <String, dynamic>{
  'age': ?instance.age,
  'birthDate': ?instance.birthDate,
  'contactPhone': ?instance.contactPhone,
  'expectedUpdatedAt': instance.expectedUpdatedAt.toIso8601String(),
  'familyName': ?instance.familyName,
  'fatherName': ?instance.fatherName,
  'givenName': ?instance.givenName,
  'motherName': ?instance.motherName,
  'previousFileNumber': ?instance.previousFileNumber,
  'secondPhone': ?instance.secondPhone,
  'sex': ?instance.sex,
};

const _$SexEnumMap = {Sex.male: 'male', Sex.female: 'female'};
