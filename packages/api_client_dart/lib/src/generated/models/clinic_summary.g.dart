// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_summary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicSummary _$ClinicSummaryFromJson(Map<String, dynamic> json) =>
    ClinicSummary(
      createdAt: DateTime.parse(json['createdAt'] as String),
      id: json['id'] as String,
      name: json['name'] as String,
      ownerName: json['ownerName'] as String?,
      ownerStatus: $enumDecodeNullable(
        _$MembershipStatusEnumMap,
        json['ownerStatus'],
      ),
      status: $enumDecode(_$ClinicStatusEnumMap, json['status']),
      subscriptionEnd: json['subscriptionEnd'] as String?,
      type: $enumDecode(_$ClinicTypeEnumMap, json['type']),
    );

Map<String, dynamic> _$ClinicSummaryToJson(ClinicSummary instance) =>
    <String, dynamic>{
      'createdAt': instance.createdAt.toIso8601String(),
      'id': instance.id,
      'name': instance.name,
      'ownerName': instance.ownerName,
      'ownerStatus': instance.ownerStatus,
      'status': instance.status,
      'subscriptionEnd': instance.subscriptionEnd,
      'type': instance.type,
    };

const _$MembershipStatusEnumMap = {
  MembershipStatus.pending: 'pending',
  MembershipStatus.active: 'active',
  MembershipStatus.deactivated: 'deactivated',
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
