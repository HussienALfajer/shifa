// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_entitlements.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicEntitlements _$ClinicEntitlementsFromJson(Map<String, dynamic> json) =>
    ClinicEntitlements(
      items: (json['items'] as List<dynamic>)
          .map((e) => EntitlementItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      plan: $enumDecode(_$ClinicTypeEnumMap, json['plan']),
    );

Map<String, dynamic> _$ClinicEntitlementsToJson(ClinicEntitlements instance) =>
    <String, dynamic>{'items': instance.items, 'plan': instance.plan};

const _$ClinicTypeEnumMap = {
  ClinicType.solo: 'solo',
  ClinicType.multiDoctor: 'multi_doctor',
  ClinicType.multiBranch: 'multi_branch',
};
