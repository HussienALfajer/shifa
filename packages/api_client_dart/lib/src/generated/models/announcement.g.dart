// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'announcement.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Announcement _$AnnouncementFromJson(Map<String, dynamic> json) => Announcement(
  body: json['body'] as String,
  clinics: (json['clinics'] as List<dynamic>)
      .map((e) => AnnouncementClinic.fromJson(e as Map<String, dynamic>))
      .toList(),
  createdAt: DateTime.parse(json['createdAt'] as String),
  createdByName: json['createdByName'] as String?,
  dismissedCount: (json['dismissedCount'] as num?)?.toInt(),
  endedByName: json['endedByName'] as String?,
  endedEarly: json['endedEarly'] as bool,
  endsAt: json['endsAt'] == null
      ? null
      : DateTime.parse(json['endsAt'] as String),
  id: json['id'] as String,
  level: $enumDecode(_$AnnouncementLevelEnumMap, json['level']),
  startsAt: DateTime.parse(json['startsAt'] as String),
  status: $enumDecode(_$AnnouncementStatusEnumMap, json['status']),
  target: $enumDecode(_$AnnouncementTargetEnumMap, json['target']),
  targetedMembers: (json['targetedMembers'] as num?)?.toInt(),
  version: (json['version'] as num).toInt(),
);

Map<String, dynamic> _$AnnouncementToJson(Announcement instance) =>
    <String, dynamic>{
      'body': instance.body,
      'clinics': instance.clinics,
      'createdAt': instance.createdAt.toIso8601String(),
      'createdByName': instance.createdByName,
      'dismissedCount': instance.dismissedCount,
      'endedByName': instance.endedByName,
      'endedEarly': instance.endedEarly,
      'endsAt': instance.endsAt?.toIso8601String(),
      'id': instance.id,
      'level': instance.level,
      'startsAt': instance.startsAt.toIso8601String(),
      'status': instance.status,
      'target': instance.target,
      'targetedMembers': instance.targetedMembers,
      'version': instance.version,
    };

const _$AnnouncementLevelEnumMap = {
  AnnouncementLevel.info: 'info',
  AnnouncementLevel.warning: 'warning',
};

const _$AnnouncementStatusEnumMap = {
  AnnouncementStatus.scheduled: 'scheduled',
  AnnouncementStatus.active: 'active',
  AnnouncementStatus.ended: 'ended',
};

const _$AnnouncementTargetEnumMap = {
  AnnouncementTarget.all: 'all',
  AnnouncementTarget.selected: 'selected',
};
