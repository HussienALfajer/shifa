// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_search_result.dart';

part 'patient_search_results.g.dart';

@JsonSerializable()
class PatientSearchResults {
  const PatientSearchResults({required this.results, required this.truncated});

  factory PatientSearchResults.fromJson(Map<String, Object?> json) =>
      _$PatientSearchResultsFromJson(json);

  final List<PatientSearchResult> results;
  final bool truncated;

  Map<String, Object?> toJson() => _$PatientSearchResultsToJson(this);
}
