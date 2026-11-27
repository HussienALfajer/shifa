// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'dismiss_announcement_request.g.dart';

@JsonSerializable()
class DismissAnnouncementRequest {
  const DismissAnnouncementRequest({required this.version});

  factory DismissAnnouncementRequest.fromJson(Map<String, Object?> json) =>
      _$DismissAnnouncementRequestFromJson(json);

  final int version;

  Map<String, Object?> toJson() => _$DismissAnnouncementRequestToJson(this);
}
