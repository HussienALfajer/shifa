// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'session_summary.dart';

part 'session_list.g.dart';

@JsonSerializable()
class SessionList {
  const SessionList({required this.sessions});

  factory SessionList.fromJson(Map<String, Object?> json) =>
      _$SessionListFromJson(json);

  final List<SessionSummary> sessions;

  Map<String, Object?> toJson() => _$SessionListToJson(this);
}
