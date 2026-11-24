// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'totp_code.dart';

part 'renew_recovery_codes.g.dart';

@JsonSerializable()
class RenewRecoveryCodes {
  const RenewRecoveryCodes({required this.code});

  factory RenewRecoveryCodes.fromJson(Map<String, Object?> json) =>
      _$RenewRecoveryCodesFromJson(json);

  final TotpCode code;

  Map<String, Object?> toJson() => _$RenewRecoveryCodesToJson(this);
}
