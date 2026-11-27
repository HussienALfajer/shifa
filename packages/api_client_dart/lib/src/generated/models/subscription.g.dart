// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'subscription.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Subscription _$SubscriptionFromJson(Map<String, dynamic> json) => Subscription(
  features: (json['features'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  limits: (json['limits'] as List<dynamic>)
      .map((e) => LimitUse.fromJson(e as Map<String, dynamic>))
      .toList(),
  plan: $enumDecode(_$ClinicTypeEnumMap, json['plan']),
  status: $enumDecode(_$ClinicStatusEnumMap, json['status']),
  subscriptionEnd: json['subscriptionEnd'] as String?,
);

Map<String, dynamic> _$SubscriptionToJson(Subscription instance) =>
    <String, dynamic>{
      'features': instance.features,
      'limits': instance.limits,
      'plan': instance.plan,
      'status': instance.status,
      'subscriptionEnd': instance.subscriptionEnd,
    };

const _$ClinicTypeEnumMap = {
  ClinicType.solo: 'solo',
  ClinicType.multiDoctor: 'multi_doctor',
  ClinicType.multiBranch: 'multi_branch',
};

const _$ClinicStatusEnumMap = {
  ClinicStatus.trial: 'trial',
  ClinicStatus.active: 'active',
  ClinicStatus.suspended: 'suspended',
};
