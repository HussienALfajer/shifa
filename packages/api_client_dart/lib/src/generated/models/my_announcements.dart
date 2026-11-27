// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'my_announcement.dart';

part 'my_announcements.g.dart';

@JsonSerializable()
class MyAnnouncements {
  const MyAnnouncements({required this.announcements});

  factory MyAnnouncements.fromJson(Map<String, Object?> json) =>
      _$MyAnnouncementsFromJson(json);

  final List<MyAnnouncement> announcements;

  Map<String, Object?> toJson() => _$MyAnnouncementsToJson(this);
}
