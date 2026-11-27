// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'announcement_level.dart';

part 'my_announcement.g.dart';

@JsonSerializable()
class MyAnnouncement {
  const MyAnnouncement({
    required this.body,
    required this.endsAt,
    required this.id,
    required this.level,
    required this.startsAt,
    required this.version,
  });

  factory MyAnnouncement.fromJson(Map<String, Object?> json) =>
      _$MyAnnouncementFromJson(json);

  final String body;
  @JsonKey(includeIfNull: true)
  final DateTime? endsAt;
  final String id;
  final AnnouncementLevel level;
  final DateTime startsAt;
  final int version;

  Map<String, Object?> toJson() => _$MyAnnouncementToJson(this);
}
