// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'announcement_level.dart';
import 'announcement_target.dart';

part 'create_announcement_request.g.dart';

@JsonSerializable()
class CreateAnnouncementRequest {
  const CreateAnnouncementRequest({
    required this.body,
    required this.level,
    required this.startsAt,
    required this.target,
    this.clinicIds,
    this.endsAt,
  });

  factory CreateAnnouncementRequest.fromJson(Map<String, Object?> json) =>
      _$CreateAnnouncementRequestFromJson(json);

  final String body;
  @JsonKey(includeIfNull: false)
  final List<String>? clinicIds;
  @JsonKey(includeIfNull: false)
  final DateTime? endsAt;
  final AnnouncementLevel level;
  final DateTime startsAt;
  final AnnouncementTarget target;

  Map<String, Object?> toJson() => _$CreateAnnouncementRequestToJson(this);
}
