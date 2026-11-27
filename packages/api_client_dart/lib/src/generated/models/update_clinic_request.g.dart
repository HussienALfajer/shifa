// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_clinic_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateClinicRequest _$UpdateClinicRequestFromJson(Map<String, dynamic> json) =>
    UpdateClinicRequest(
      status: $enumDecodeNullable(_$ClinicStatusEnumMap, json['status']),
      subscriptionEnd: json['subscriptionEnd'] as String?,
      type: $enumDecodeNullable(_$ClinicTypeEnumMap, json['type']),
    );

Map<String, dynamic> _$UpdateClinicRequestToJson(
  UpdateClinicRequest instance,
) => <String, dynamic>{
  'status': ?instance.status,
  'subscriptionEnd': ?instance.subscriptionEnd,
  'type': ?instance.type,
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
