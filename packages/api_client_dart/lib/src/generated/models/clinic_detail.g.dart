// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_detail.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicDetail _$ClinicDetailFromJson(Map<String, dynamic> json) => ClinicDetail(
  createdAt: DateTime.parse(json['createdAt'] as String),
  id: json['id'] as String,
  name: json['name'] as String,
  owner: json['owner'] == null
      ? null
      : ClinicOwner.fromJson(json['owner'] as Map<String, dynamic>),
  ownerName: json['ownerName'] as String?,
  status: $enumDecode(_$ClinicStatusEnumMap, json['status']),
  subscriptionEnd: json['subscriptionEnd'] as String?,
  type: $enumDecode(_$ClinicTypeEnumMap, json['type']),
);

Map<String, dynamic> _$ClinicDetailToJson(ClinicDetail instance) =>
    <String, dynamic>{
      'createdAt': instance.createdAt.toIso8601String(),
      'id': instance.id,
      'name': instance.name,
      'owner': instance.owner,
      'ownerName': instance.ownerName,
      'status': instance.status,
      'subscriptionEnd': instance.subscriptionEnd,
      'type': instance.type,
    };

const _$ClinicStatusEnumMap = {
  ClinicStatus.trial: 'trial',
  ClinicStatus.active: 'active',
  ClinicStatus.suspended: 'suspended',
};

const _$ClinicTypeEnumMap = {
  ClinicType.solo: 'solo',
  ClinicType.multiDoctor: 'multi_doctor',
  ClinicType.multiBranch: 'multi_branch',
};
