// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'duplicate_candidate.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DuplicateCandidate _$DuplicateCandidateFromJson(Map<String, dynamic> json) =>
    DuplicateCandidate(
      card: json['card'] == null
          ? null
          : PatientCard.fromJson(json['card'] as Map<String, dynamic>),
      fileNumber: (json['fileNumber'] as num).toInt(),
      reason: $enumDecode(_$DuplicateReasonEnumMap, json['reason']),
      visible: json['visible'] as bool,
    );

Map<String, dynamic> _$DuplicateCandidateToJson(DuplicateCandidate instance) =>
    <String, dynamic>{
      'card': instance.card,
      'fileNumber': instance.fileNumber,
      'reason': instance.reason,
      'visible': instance.visible,
    };

const _$DuplicateReasonEnumMap = {
  DuplicateReason.samePhoneSimilarName: 'same_phone_similar_name',
  DuplicateReason.similarNameNearBirthYear: 'similar_name_near_birth_year',
};
