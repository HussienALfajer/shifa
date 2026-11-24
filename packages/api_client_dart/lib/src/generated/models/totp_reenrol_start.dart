// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'totp_code.dart';

part 'totp_reenrol_start.g.dart';

@JsonSerializable()
class TotpReenrolStart {
  const TotpReenrolStart({required this.code});

  factory TotpReenrolStart.fromJson(Map<String, Object?> json) =>
      _$TotpReenrolStartFromJson(json);

  final TotpCode code;

  Map<String, Object?> toJson() => _$TotpReenrolStartToJson(this);
}
