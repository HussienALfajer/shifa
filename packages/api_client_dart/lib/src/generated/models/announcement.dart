// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'announcement_clinic.dart';
import 'announcement_level.dart';
import 'announcement_status.dart';
import 'announcement_target.dart';

part 'announcement.g.dart';

@JsonSerializable()
class Announcement {
  const Announcement({
    required this.body,
    required this.clinics,
    required this.createdAt,
    required this.createdByName,
    required this.dismissedCount,
    required this.endedByName,
    required this.endedEarly,
    required this.endsAt,
    required this.id,
    required this.level,
    required this.startsAt,
    required this.status,
    required this.target,
    required this.targetedMembers,
    required this.version,
  });

  factory Announcement.fromJson(Map<String, Object?> json) =>
      _$AnnouncementFromJson(json);

  final String body;
  final List<AnnouncementClinic> clinics;
  final DateTime createdAt;
  @JsonKey(includeIfNull: true)
  final String? createdByName;
  @JsonKey(includeIfNull: true)
  final int? dismissedCount;
  @JsonKey(includeIfNull: true)
  final String? endedByName;
  final bool endedEarly;
  @JsonKey(includeIfNull: true)
  final DateTime? endsAt;
  final String id;
  final AnnouncementLevel level;
  final DateTime startsAt;
  final AnnouncementStatus status;
  final AnnouncementTarget target;
  @JsonKey(includeIfNull: true)
  final int? targetedMembers;
  final int version;

  Map<String, Object?> toJson() => _$AnnouncementToJson(this);
}
