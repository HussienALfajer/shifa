// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'duplicate_candidates.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DuplicateCandidates _$DuplicateCandidatesFromJson(Map<String, dynamic> json) =>
    DuplicateCandidates(
      candidates: (json['candidates'] as List<dynamic>)
          .map((e) => DuplicateCandidate.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$DuplicateCandidatesToJson(
  DuplicateCandidates instance,
) => <String, dynamic>{'candidates': instance.candidates};
