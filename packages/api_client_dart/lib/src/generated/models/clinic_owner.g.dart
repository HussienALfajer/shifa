// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_owner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicOwner _$ClinicOwnerFromJson(Map<String, dynamic> json) => ClinicOwner(
  linkExpiresAt: json['linkExpiresAt'] == null
      ? null
      : DateTime.parse(json['linkExpiresAt'] as String),
  membershipId: json['membershipId'] as String,
  name: json['name'] as String,
  phoneMasked: json['phoneMasked'] as String,
  status: $enumDecode(_$MembershipStatusEnumMap, json['status']),
);

Map<String, dynamic> _$ClinicOwnerToJson(ClinicOwner instance) =>
    <String, dynamic>{
      'linkExpiresAt': instance.linkExpiresAt?.toIso8601String(),
      'membershipId': instance.membershipId,
      'name': instance.name,
      'phoneMasked': instance.phoneMasked,
      'status': instance.status,
    };

const _$MembershipStatusEnumMap = {
  MembershipStatus.pending: 'pending',
  MembershipStatus.active: 'active',
  MembershipStatus.deactivated: 'deactivated',
};
