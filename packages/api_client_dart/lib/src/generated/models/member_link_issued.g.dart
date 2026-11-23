// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'member_link_issued.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MemberLinkIssued _$MemberLinkIssuedFromJson(Map<String, dynamic> json) =>
    MemberLinkIssued(
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      url: json['url'] as String,
      whatsappUrl: json['whatsappUrl'] as String,
    );

Map<String, dynamic> _$MemberLinkIssuedToJson(MemberLinkIssued instance) =>
    <String, dynamic>{
      'expiresAt': instance.expiresAt.toIso8601String(),
      'url': instance.url,
      'whatsappUrl': instance.whatsappUrl,
    };
