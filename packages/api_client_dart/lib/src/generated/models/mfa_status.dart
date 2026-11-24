// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'mfa_status.g.dart';

@JsonSerializable()
class MfaStatus {
  const MfaStatus({
    required this.enrolled,
    required this.enrolledAt,
    required this.recoveryCodesLeft,
  });

  factory MfaStatus.fromJson(Map<String, Object?> json) =>
      _$MfaStatusFromJson(json);

  final bool enrolled;
  @JsonKey(includeIfNull: true)
  final DateTime? enrolledAt;
  @JsonKey(includeIfNull: true)
  final int? recoveryCodesLeft;

  Map<String, Object?> toJson() => _$MfaStatusToJson(this);
}
