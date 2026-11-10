// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'validation_issue_code.dart';

part 'validation_issue.g.dart';

@JsonSerializable()
class ValidationIssue {
  const ValidationIssue({required this.code, required this.path});

  factory ValidationIssue.fromJson(Map<String, Object?> json) =>
      _$ValidationIssueFromJson(json);

  final ValidationIssueCode code;
  final String path;

  Map<String, Object?> toJson() => _$ValidationIssueToJson(this);
}
