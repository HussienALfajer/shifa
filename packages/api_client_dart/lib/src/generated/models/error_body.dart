// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'error_code.dart';
import 'validation_issue.dart';

part 'error_body.g.dart';

@JsonSerializable()
class ErrorBody {
  const ErrorBody({required this.code, required this.message, this.details});

  factory ErrorBody.fromJson(Map<String, Object?> json) =>
      _$ErrorBodyFromJson(json);

  final ErrorCode code;
  final List<ValidationIssue>? details;
  final String message;

  Map<String, Object?> toJson() => _$ErrorBodyToJson(this);
}
