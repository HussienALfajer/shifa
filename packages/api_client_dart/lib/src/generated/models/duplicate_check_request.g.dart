// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'duplicate_check_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DuplicateCheckRequest _$DuplicateCheckRequestFromJson(
  Map<String, dynamic> json,
) => DuplicateCheckRequest(
  age: json['age'] == null
      ? null
      : PatientAge.fromJson(json['age'] as Map<String, dynamic>),
  birthDate: json['birthDate'] as String?,
  contactPhone: json['contactPhone'] as String?,
  excludeId: json['excludeId'] as String?,
  familyName: json['familyName'] as String?,
  fatherName: json['fatherName'] as String?,
  givenName: json['givenName'] as String?,
);

Map<String, dynamic> _$DuplicateCheckRequestToJson(
  DuplicateCheckRequest instance,
) => <String, dynamic>{
  'age': ?instance.age,
  'birthDate': ?instance.birthDate,
  'contactPhone': ?instance.contactPhone,
  'excludeId': ?instance.excludeId,
  'familyName': ?instance.familyName,
  'fatherName': ?instance.fatherName,
  'givenName': ?instance.givenName,
};
