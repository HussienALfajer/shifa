// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'support_grant_view.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupportGrantView _$SupportGrantViewFromJson(Map<String, dynamic> json) =>
    SupportGrantView(
      adminName: json['adminName'] as String,
      endedAt: json['endedAt'] == null
          ? null
          : DateTime.parse(json['endedAt'] as String),
      endedBy: $enumDecodeNullable(_$SupportEndedByEnumMap, json['endedBy']),
      endedByName: json['endedByName'] as String?,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      id: json['id'] as String,
      reason: json['reason'] as String,
      startedAt: DateTime.parse(json['startedAt'] as String),
    );

Map<String, dynamic> _$SupportGrantViewToJson(SupportGrantView instance) =>
    <String, dynamic>{
      'adminName': instance.adminName,
      'endedAt': instance.endedAt?.toIso8601String(),
      'endedBy': instance.endedBy,
      'endedByName': instance.endedByName,
      'expiresAt': instance.expiresAt.toIso8601String(),
      'id': instance.id,
      'reason': instance.reason,
      'startedAt': instance.startedAt.toIso8601String(),
    };

const _$SupportEndedByEnumMap = {
  SupportEndedBy.admin: 'admin',
  SupportEndedBy.owner: 'owner',
  SupportEndedBy.expiry: 'expiry',
};
