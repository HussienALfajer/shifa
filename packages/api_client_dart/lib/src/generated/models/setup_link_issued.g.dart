// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'setup_link_issued.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SetupLinkIssued _$SetupLinkIssuedFromJson(Map<String, dynamic> json) =>
    SetupLinkIssued(
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      purpose: $enumDecode(_$SetupLinkPurposeEnumMap, json['purpose']),
      url: json['url'] as String,
      whatsappUrl: json['whatsappUrl'] as String,
    );

Map<String, dynamic> _$SetupLinkIssuedToJson(SetupLinkIssued instance) =>
    <String, dynamic>{
      'expiresAt': instance.expiresAt.toIso8601String(),
      'purpose': instance.purpose,
      'url': instance.url,
      'whatsappUrl': instance.whatsappUrl,
    };

const _$SetupLinkPurposeEnumMap = {
  SetupLinkPurpose.ownerSetup: 'owner_setup',
  SetupLinkPurpose.memberSetup: 'member_setup',
  SetupLinkPurpose.invitation: 'invitation',
  SetupLinkPurpose.adminSetup: 'admin_setup',
};
