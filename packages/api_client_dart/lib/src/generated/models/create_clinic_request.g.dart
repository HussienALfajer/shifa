// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_clinic_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateClinicRequest _$CreateClinicRequestFromJson(Map<String, dynamic> json) =>
    CreateClinicRequest(
      name: json['name'] as String,
      ownerName: json['ownerName'] as String,
      ownerPhone: json['ownerPhone'] as String,
      status: $enumDecode(_$ClinicStatusEnumMap, json['status']),
      type: $enumDecode(_$ClinicTypeEnumMap, json['type']),
      subscriptionEnd: json['subscriptionEnd'] as String?,
    );

Map<String, dynamic> _$CreateClinicRequestToJson(
  CreateClinicRequest instance,
) => <String, dynamic>{
  'name': instance.name,
  'ownerName': instance.ownerName,
  'ownerPhone': instance.ownerPhone,
  'status': instance.status,
  'subscriptionEnd': ?instance.subscriptionEnd,
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
