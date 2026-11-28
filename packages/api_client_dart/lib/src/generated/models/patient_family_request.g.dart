// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_family_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFamilyRequest _$PatientFamilyRequestFromJson(
  Map<String, dynamic> json,
) => PatientFamilyRequest(
  phone: json['phone'] as String,
  excludeId: json['excludeId'] as String?,
);

Map<String, dynamic> _$PatientFamilyRequestToJson(
  PatientFamilyRequest instance,
) => <String, dynamic>{
  'excludeId': ?instance.excludeId,
  'phone': instance.phone,
};
