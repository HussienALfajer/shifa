// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'totp_code.dart';

part 'totp_enrol_confirm.g.dart';

@JsonSerializable()
class TotpEnrolConfirm {
  const TotpEnrolConfirm({required this.code});

  factory TotpEnrolConfirm.fromJson(Map<String, Object?> json) =>
      _$TotpEnrolConfirmFromJson(json);

  final TotpCode code;

  Map<String, Object?> toJson() => _$TotpEnrolConfirmToJson(this);
}
