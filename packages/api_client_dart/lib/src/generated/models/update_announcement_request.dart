// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'announcement_level.dart';
import 'announcement_target.dart';

part 'update_announcement_request.g.dart';

@JsonSerializable()
class UpdateAnnouncementRequest {
  const UpdateAnnouncementRequest({
    this.body,
    this.clinicIds,
    this.endsAt,
    this.level,
    this.startsAt,
    this.target,
  });

  factory UpdateAnnouncementRequest.fromJson(Map<String, Object?> json) =>
      _$UpdateAnnouncementRequestFromJson(json);

  @JsonKey(includeIfNull: false)
  final String? body;
  @JsonKey(includeIfNull: false)
  final List<String>? clinicIds;
  @JsonKey(includeIfNull: false)
  final DateTime? endsAt;
  @JsonKey(includeIfNull: false)
  final AnnouncementLevel? level;
  @JsonKey(includeIfNull: false)
  final DateTime? startsAt;
  @JsonKey(includeIfNull: false)
  final AnnouncementTarget? target;

  Map<String, Object?> toJson() => _$UpdateAnnouncementRequestToJson(this);
}
