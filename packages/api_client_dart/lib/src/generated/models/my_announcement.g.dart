// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_announcement.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MyAnnouncement _$MyAnnouncementFromJson(Map<String, dynamic> json) =>
    MyAnnouncement(
      body: json['body'] as String,
      endsAt: json['endsAt'] == null
          ? null
          : DateTime.parse(json['endsAt'] as String),
      id: json['id'] as String,
      level: $enumDecode(_$AnnouncementLevelEnumMap, json['level']),
      startsAt: DateTime.parse(json['startsAt'] as String),
      version: (json['version'] as num).toInt(),
    );

Map<String, dynamic> _$MyAnnouncementToJson(MyAnnouncement instance) =>
    <String, dynamic>{
      'body': instance.body,
      'endsAt': instance.endsAt?.toIso8601String(),
      'id': instance.id,
      'level': instance.level,
      'startsAt': instance.startsAt.toIso8601String(),
      'version': instance.version,
    };

const _$AnnouncementLevelEnumMap = {
  AnnouncementLevel.info: 'info',
  AnnouncementLevel.warning: 'warning',
};
