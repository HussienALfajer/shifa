// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'setup_link_purpose.dart';

part 'setup_link_issued.g.dart';

@JsonSerializable()
class SetupLinkIssued {
  const SetupLinkIssued({
    required this.expiresAt,
    required this.purpose,
    required this.url,
    required this.whatsappUrl,
  });

  factory SetupLinkIssued.fromJson(Map<String, Object?> json) =>
      _$SetupLinkIssuedFromJson(json);

  final DateTime expiresAt;
  final SetupLinkPurpose purpose;
  final String url;
  final String whatsappUrl;

  Map<String, Object?> toJson() => _$SetupLinkIssuedToJson(this);
}
