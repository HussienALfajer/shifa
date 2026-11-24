// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'totp_code.dart';

part 'totp_reenrol_confirm.g.dart';

@JsonSerializable()
class TotpReenrolConfirm {
  const TotpReenrolConfirm({required this.code});

  factory TotpReenrolConfirm.fromJson(Map<String, Object?> json) =>
      _$TotpReenrolConfirmFromJson(json);

  final TotpCode code;

  Map<String, Object?> toJson() => _$TotpReenrolConfirmToJson(this);
}
