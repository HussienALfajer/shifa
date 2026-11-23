// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'session_view.dart';

part 'mfa_enrolled.g.dart';

@JsonSerializable()
class MfaEnrolled {
  const MfaEnrolled({required this.recoveryCodes, required this.session});

  factory MfaEnrolled.fromJson(Map<String, Object?> json) =>
      _$MfaEnrolledFromJson(json);

  final List<String> recoveryCodes;
  final SessionView session;

  Map<String, Object?> toJson() => _$MfaEnrolledToJson(this);
}
