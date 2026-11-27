// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_search_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientSearchRequest _$PatientSearchRequestFromJson(
  Map<String, dynamic> json,
) => PatientSearchRequest(
  term: json['term'] as String,
  includeArchived: json['includeArchived'] as bool?,
);

Map<String, dynamic> _$PatientSearchRequestToJson(
  PatientSearchRequest instance,
) => <String, dynamic>{
  'includeArchived': ?instance.includeArchived,
  'term': instance.term,
};
