// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'totp_enrol_start.g.dart';

@JsonSerializable()
class TotpEnrolStart {
  const TotpEnrolStart({required this.manualKey, required this.otpauthUri});

  factory TotpEnrolStart.fromJson(Map<String, Object?> json) =>
      _$TotpEnrolStartFromJson(json);

  final String manualKey;
  final String otpauthUri;

  Map<String, Object?> toJson() => _$TotpEnrolStartToJson(this);
}
