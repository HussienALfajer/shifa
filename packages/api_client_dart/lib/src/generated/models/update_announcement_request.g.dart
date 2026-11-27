// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_announcement_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateAnnouncementRequest _$UpdateAnnouncementRequestFromJson(
  Map<String, dynamic> json,
) => UpdateAnnouncementRequest(
  body: json['body'] as String?,
  clinicIds: (json['clinicIds'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  endsAt: json['endsAt'] == null
      ? null
      : DateTime.parse(json['endsAt'] as String),
  level: $enumDecodeNullable(_$AnnouncementLevelEnumMap, json['level']),
  startsAt: json['startsAt'] == null
      ? null
      : DateTime.parse(json['startsAt'] as String),
  target: $enumDecodeNullable(_$AnnouncementTargetEnumMap, json['target']),
);

Map<String, dynamic> _$UpdateAnnouncementRequestToJson(
  UpdateAnnouncementRequest instance,
) => <String, dynamic>{
  'body': ?instance.body,
  'clinicIds': ?instance.clinicIds,
  'endsAt': ?instance.endsAt?.toIso8601String(),
  'level': ?instance.level,
  'startsAt': ?instance.startsAt?.toIso8601String(),
  'target': ?instance.target,
};

const _$AnnouncementLevelEnumMap = {
  AnnouncementLevel.info: 'info',
  AnnouncementLevel.warning: 'warning',
};

const _$AnnouncementTargetEnumMap = {
  AnnouncementTarget.all: 'all',
  AnnouncementTarget.selected: 'selected',
};
