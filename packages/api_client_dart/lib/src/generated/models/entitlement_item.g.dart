// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'entitlement_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

EntitlementItem _$EntitlementItemFromJson(Map<String, dynamic> json) =>
    EntitlementItem(
      effective: json['effective'],
      key: json['key'] as String,
      kind: $enumDecode(_$EntitlementKindEnumMap, json['kind']),
      override: json['override'] == null
          ? null
          : EntitlementOverride.fromJson(
              json['override'] as Map<String, dynamic>,
            ),
      planValue: json['planValue'],
      used: (json['used'] as num?)?.toInt(),
    );

Map<String, dynamic> _$EntitlementItemToJson(EntitlementItem instance) =>
    <String, dynamic>{
      'effective': ?instance.effective,
      'key': instance.key,
      'kind': instance.kind,
      'override': instance.override,
      'planValue': ?instance.planValue,
      'used': instance.used,
    };

const _$EntitlementKindEnumMap = {
  EntitlementKind.limit: 'limit',
  EntitlementKind.feature: 'feature',
};
