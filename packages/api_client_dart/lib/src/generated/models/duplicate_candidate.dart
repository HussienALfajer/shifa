// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'duplicate_reason.dart';
import 'patient_card.dart';

part 'duplicate_candidate.g.dart';

@JsonSerializable()
class DuplicateCandidate {
  const DuplicateCandidate({
    required this.card,
    required this.fileNumber,
    required this.reason,
    required this.visible,
  });

  factory DuplicateCandidate.fromJson(Map<String, Object?> json) =>
      _$DuplicateCandidateFromJson(json);

  @JsonKey(includeIfNull: true)
  final PatientCard? card;
  final int fileNumber;
  final DuplicateReason reason;
  final bool visible;

  Map<String, Object?> toJson() => _$DuplicateCandidateToJson(this);
}
