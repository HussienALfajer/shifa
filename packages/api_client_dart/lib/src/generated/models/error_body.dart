// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'error_code.dart';
import 'limit_reached.dart';
import 'place_kind.dart';
import 'session_end_reason.dart';
import 'support_ended.dart';
import 'validation_issue.dart';

part 'error_body.g.dart';

@JsonSerializable()
class ErrorBody {
  const ErrorBody({
    required this.code,
    required this.message,
    this.details,
    this.limitReached,
    this.place,
    this.reason,
    this.supportEnded,
    this.until,
  });

  factory ErrorBody.fromJson(Map<String, Object?> json) =>
      _$ErrorBodyFromJson(json);

  final ErrorCode code;
  @JsonKey(includeIfNull: false)
  final List<ValidationIssue>? details;
  @JsonKey(includeIfNull: false)
  final LimitReached? limitReached;
  final String message;
  @JsonKey(includeIfNull: false)
  final PlaceKind? place;
  @JsonKey(includeIfNull: false)
  final SessionEndReason? reason;
  @JsonKey(includeIfNull: false)
  final SupportEnded? supportEnded;
  @JsonKey(includeIfNull: false)
  final DateTime? until;

  Map<String, Object?> toJson() => _$ErrorBodyToJson(this);
}
