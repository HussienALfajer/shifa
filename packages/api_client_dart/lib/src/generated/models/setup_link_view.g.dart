// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'setup_link_view.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SetupLinkView _$SetupLinkViewFromJson(Map<String, dynamic> json) =>
    SetupLinkView(
      clinicName: json['clinicName'] as String?,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      personName: json['personName'] as String,
      phoneMasked: json['phoneMasked'] as String,
      purpose: $enumDecode(_$SetupLinkPurposeEnumMap, json['purpose']),
      role: $enumDecode(_$SetupLinkRoleEnumMap, json['role']),
    );

Map<String, dynamic> _$SetupLinkViewToJson(SetupLinkView instance) =>
    <String, dynamic>{
      'clinicName': instance.clinicName,
      'expiresAt': instance.expiresAt.toIso8601String(),
      'personName': instance.personName,
      'phoneMasked': instance.phoneMasked,
      'purpose': instance.purpose,
      'role': instance.role,
    };

const _$SetupLinkPurposeEnumMap = {
  SetupLinkPurpose.ownerSetup: 'owner_setup',
  SetupLinkPurpose.memberSetup: 'member_setup',
  SetupLinkPurpose.invitation: 'invitation',
  SetupLinkPurpose.adminSetup: 'admin_setup',
};

const _$SetupLinkRoleEnumMap = {
  SetupLinkRole.owner: 'owner',
  SetupLinkRole.doctor: 'doctor',
  SetupLinkRole.receptionist: 'receptionist',
  SetupLinkRole.assistant: 'assistant',
  SetupLinkRole.accountant: 'accountant',
  SetupLinkRole.platformAdmin: 'platform_admin',
};
