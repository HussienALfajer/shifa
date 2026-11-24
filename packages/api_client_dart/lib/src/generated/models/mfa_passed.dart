// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'session_view.dart';

part 'mfa_passed.g.dart';

@JsonSerializable()
class MfaPassed {
  const MfaPassed({required this.recoveryCodesLeft, required this.session});

  factory MfaPassed.fromJson(Map<String, Object?> json) =>
      _$MfaPassedFromJson(json);

  final int recoveryCodesLeft;
  final SessionView session;

  Map<String, Object?> toJson() => _$MfaPassedToJson(this);
}
