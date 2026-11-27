// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'support_ended.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupportEnded _$SupportEndedFromJson(Map<String, dynamic> json) => SupportEnded(
  endedAt: DateTime.parse(json['endedAt'] as String),
  endedBy: $enumDecode(_$SupportEndedByEnumMap, json['endedBy']),
  ownerName: json['ownerName'] as String?,
);

Map<String, dynamic> _$SupportEndedToJson(SupportEnded instance) =>
    <String, dynamic>{
      'endedAt': instance.endedAt.toIso8601String(),
      'endedBy': instance.endedBy,
      'ownerName': instance.ownerName,
    };

const _$SupportEndedByEnumMap = {
  SupportEndedBy.admin: 'admin',
  SupportEndedBy.owner: 'owner',
  SupportEndedBy.expiry: 'expiry',
};
