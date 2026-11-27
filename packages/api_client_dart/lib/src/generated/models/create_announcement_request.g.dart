// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_announcement_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateAnnouncementRequest _$CreateAnnouncementRequestFromJson(
  Map<String, dynamic> json,
) => CreateAnnouncementRequest(
  body: json['body'] as String,
  level: $enumDecode(_$AnnouncementLevelEnumMap, json['level']),
  startsAt: DateTime.parse(json['startsAt'] as String),
  target: $enumDecode(_$AnnouncementTargetEnumMap, json['target']),
  clinicIds: (json['clinicIds'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  endsAt: json['endsAt'] == null
      ? null
      : DateTime.parse(json['endsAt'] as String),
);

Map<String, dynamic> _$CreateAnnouncementRequestToJson(
  CreateAnnouncementRequest instance,
) => <String, dynamic>{
  'body': instance.body,
  'clinicIds': ?instance.clinicIds,
  'endsAt': ?instance.endsAt?.toIso8601String(),
  'level': instance.level,
  'startsAt': instance.startsAt.toIso8601String(),
  'target': instance.target,
};

const _$AnnouncementLevelEnumMap = {
  AnnouncementLevel.info: 'info',
  AnnouncementLevel.warning: 'warning',
};

const _$AnnouncementTargetEnumMap = {
  AnnouncementTarget.all: 'all',
  AnnouncementTarget.selected: 'selected',
};
