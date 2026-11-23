// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_owner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicOwner _$ClinicOwnerFromJson(Map<String, dynamic> json) => ClinicOwner(
  membershipId: json['membershipId'] as String,
  name: json['name'] as String,
  status: $enumDecode(_$MembershipStatusEnumMap, json['status']),
);

Map<String, dynamic> _$ClinicOwnerToJson(ClinicOwner instance) =>
    <String, dynamic>{
      'membershipId': instance.membershipId,
      'name': instance.name,
      'status': instance.status,
    };

const _$MembershipStatusEnumMap = {
  MembershipStatus.pending: 'pending',
  MembershipStatus.active: 'active',
  MembershipStatus.deactivated: 'deactivated',
};
