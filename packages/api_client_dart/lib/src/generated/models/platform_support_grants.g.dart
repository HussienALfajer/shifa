// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'platform_support_grants.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlatformSupportGrants _$PlatformSupportGrantsFromJson(
  Map<String, dynamic> json,
) => PlatformSupportGrants(
  grants: (json['grants'] as List<dynamic>)
      .map((e) => SupportGrantView.fromJson(e as Map<String, dynamic>))
      .toList(),
  mine: json['mine'] == null
      ? null
      : SupportGrantView.fromJson(json['mine'] as Map<String, dynamic>),
  now: DateTime.parse(json['now'] as String),
);

Map<String, dynamic> _$PlatformSupportGrantsToJson(
  PlatformSupportGrants instance,
) => <String, dynamic>{
  'grants': instance.grants,
  'mine': instance.mine,
  'now': instance.now.toIso8601String(),
};
