// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'announcement_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AnnouncementList _$AnnouncementListFromJson(Map<String, dynamic> json) =>
    AnnouncementList(
      announcements: (json['announcements'] as List<dynamic>)
          .map((e) => Announcement.fromJson(e as Map<String, dynamic>))
          .toList(),
      counts: AnnouncementCounts.fromJson(
        json['counts'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$AnnouncementListToJson(AnnouncementList instance) =>
    <String, dynamic>{
      'announcements': instance.announcements,
      'counts': instance.counts,
    };
