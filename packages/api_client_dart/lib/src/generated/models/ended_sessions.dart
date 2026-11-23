// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'ended_sessions.g.dart';

@JsonSerializable()
class EndedSessions {
  const EndedSessions({required this.ended});

  factory EndedSessions.fromJson(Map<String, Object?> json) =>
      _$EndedSessionsFromJson(json);

  final int ended;

  Map<String, Object?> toJson() => _$EndedSessionsToJson(this);
}
