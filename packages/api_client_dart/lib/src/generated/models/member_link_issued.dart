// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'member_link_issued.g.dart';

@JsonSerializable()
class MemberLinkIssued {
  const MemberLinkIssued({
    required this.expiresAt,
    required this.url,
    required this.whatsappUrl,
  });

  factory MemberLinkIssued.fromJson(Map<String, Object?> json) =>
      _$MemberLinkIssuedFromJson(json);

  final DateTime expiresAt;
  final String url;
  final String whatsappUrl;

  Map<String, Object?> toJson() => _$MemberLinkIssuedToJson(this);
}
