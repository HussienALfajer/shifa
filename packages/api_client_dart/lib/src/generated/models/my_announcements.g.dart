// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_announcements.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MyAnnouncements _$MyAnnouncementsFromJson(Map<String, dynamic> json) =>
    MyAnnouncements(
      announcements: (json['announcements'] as List<dynamic>)
          .map((e) => MyAnnouncement.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$MyAnnouncementsToJson(MyAnnouncements instance) =>
    <String, dynamic>{'announcements': instance.announcements};
