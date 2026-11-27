// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'entitlement_override.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

EntitlementOverride _$EntitlementOverrideFromJson(Map<String, dynamic> json) =>
    EntitlementOverride(
      expired: json['expired'] as bool,
      expiresAt: json['expiresAt'] as String?,
      reason: json['reason'] as String,
      setAt: DateTime.parse(json['setAt'] as String),
      setByName: json['setByName'] as String?,
      value: EntitlementValue.fromJson(json['value'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$EntitlementOverrideToJson(
  EntitlementOverride instance,
) => <String, dynamic>{
  'expired': instance.expired,
  'expiresAt': instance.expiresAt,
  'reason': instance.reason,
  'setAt': instance.setAt.toIso8601String(),
  'setByName': instance.setByName,
  'value': instance.value,
};
