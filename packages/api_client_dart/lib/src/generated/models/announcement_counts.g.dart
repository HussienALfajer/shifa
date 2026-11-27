// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'announcement_counts.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AnnouncementCounts _$AnnouncementCountsFromJson(Map<String, dynamic> json) =>
    AnnouncementCounts(
      active: (json['active'] as num).toInt(),
      ended: (json['ended'] as num).toInt(),
      scheduled: (json['scheduled'] as num).toInt(),
    );

Map<String, dynamic> _$AnnouncementCountsToJson(AnnouncementCounts instance) =>
    <String, dynamic>{
      'active': instance.active,
      'ended': instance.ended,
      'scheduled': instance.scheduled,
    };
