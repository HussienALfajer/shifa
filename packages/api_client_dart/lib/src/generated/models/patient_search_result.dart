// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_match_kind.dart';
import 'patient_state.dart';
import 'sex.dart';

part 'patient_search_result.g.dart';

@JsonSerializable()
class PatientSearchResult {
  const PatientSearchResult({
    required this.archivedAt,
    required this.birthDate,
    required this.birthDateEstimated,
    required this.contactPhone,
    required this.displayName,
    required this.familyName,
    required this.fatherName,
    required this.fileNumber,
    required this.givenName,
    required this.id,
    required this.matchedBy,
    required this.matchedParts,
    required this.mergedFileNumber,
    required this.sex,
    required this.state,
  });

  factory PatientSearchResult.fromJson(Map<String, Object?> json) =>
      _$PatientSearchResultFromJson(json);

  @JsonKey(includeIfNull: true)
  final DateTime? archivedAt;
  final String birthDate;
  final bool birthDateEstimated;
  final String contactPhone;
  final String displayName;
  @JsonKey(includeIfNull: true)
  final String? familyName;
  @JsonKey(includeIfNull: true)
  final String? fatherName;
  final int fileNumber;
  final String givenName;
  final String id;
  final PatientMatchKind matchedBy;
  final List<int> matchedParts;
  @JsonKey(includeIfNull: true)
  final int? mergedFileNumber;
  final Sex sex;
  final PatientState state;

  Map<String, Object?> toJson() => _$PatientSearchResultToJson(this);
}
