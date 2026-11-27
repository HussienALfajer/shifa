// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'announcement_counts.g.dart';

@JsonSerializable()
class AnnouncementCounts {
  const AnnouncementCounts({
    required this.active,
    required this.ended,
    required this.scheduled,
  });

  factory AnnouncementCounts.fromJson(Map<String, Object?> json) =>
      _$AnnouncementCountsFromJson(json);

  final int active;
  final int ended;
  final int scheduled;

  Map<String, Object?> toJson() => _$AnnouncementCountsToJson(this);
}
