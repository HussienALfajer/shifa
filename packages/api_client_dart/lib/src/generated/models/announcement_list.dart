// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'announcement.dart';
import 'announcement_counts.dart';

part 'announcement_list.g.dart';

@JsonSerializable()
class AnnouncementList {
  const AnnouncementList({required this.announcements, required this.counts});

  factory AnnouncementList.fromJson(Map<String, Object?> json) =>
      _$AnnouncementListFromJson(json);

  final List<Announcement> announcements;
  final AnnouncementCounts counts;

  Map<String, Object?> toJson() => _$AnnouncementListToJson(this);
}
