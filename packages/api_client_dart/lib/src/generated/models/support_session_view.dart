// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'support_session_view.g.dart';

@JsonSerializable()
class SupportSessionView {
  const SupportSessionView({
    required this.clinicName,
    required this.expiresAt,
    required this.grantId,
    required this.now,
    required this.reason,
  });

  factory SupportSessionView.fromJson(Map<String, Object?> json) =>
      _$SupportSessionViewFromJson(json);

  final String clinicName;
  final DateTime expiresAt;
  final String grantId;
  final DateTime now;
  final String reason;

  Map<String, Object?> toJson() => _$SupportSessionViewToJson(this);
}
