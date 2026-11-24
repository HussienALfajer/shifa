// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'recovery_codes.g.dart';

@JsonSerializable()
class RecoveryCodes {
  const RecoveryCodes({required this.recoveryCodes});

  factory RecoveryCodes.fromJson(Map<String, Object?> json) =>
      _$RecoveryCodesFromJson(json);

  final List<String> recoveryCodes;

  Map<String, Object?> toJson() => _$RecoveryCodesToJson(this);
}
