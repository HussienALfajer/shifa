// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'support_banner_grant.g.dart';

@JsonSerializable()
class SupportBannerGrant {
  const SupportBannerGrant({
    required this.adminName,
    required this.expiresAt,
    required this.id,
    required this.reason,
  });

  factory SupportBannerGrant.fromJson(Map<String, Object?> json) =>
      _$SupportBannerGrantFromJson(json);

  final String adminName;
  final DateTime expiresAt;
  final String id;
  final String reason;

  Map<String, Object?> toJson() => _$SupportBannerGrantToJson(this);
}
