// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_search_results.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientSearchResults _$PatientSearchResultsFromJson(
  Map<String, dynamic> json,
) => PatientSearchResults(
  results: (json['results'] as List<dynamic>)
      .map((e) => PatientSearchResult.fromJson(e as Map<String, dynamic>))
      .toList(),
  truncated: json['truncated'] as bool,
);

Map<String, dynamic> _$PatientSearchResultsToJson(
  PatientSearchResults instance,
) => <String, dynamic>{
  'results': instance.results,
  'truncated': instance.truncated,
};
