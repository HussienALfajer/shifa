// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'duplicate_candidate.dart';

part 'duplicate_candidates.g.dart';

@JsonSerializable()
class DuplicateCandidates {
  const DuplicateCandidates({required this.candidates});

  factory DuplicateCandidates.fromJson(Map<String, Object?> json) =>
      _$DuplicateCandidatesFromJson(json);

  final List<DuplicateCandidate> candidates;

  Map<String, Object?> toJson() => _$DuplicateCandidatesToJson(this);
}
