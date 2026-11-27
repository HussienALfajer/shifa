// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_support_grants.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicSupportGrants _$ClinicSupportGrantsFromJson(Map<String, dynamic> json) =>
    ClinicSupportGrants(
      grants: (json['grants'] as List<dynamic>)
          .map((e) => SupportGrantView.fromJson(e as Map<String, dynamic>))
          .toList(),
      now: DateTime.parse(json['now'] as String),
      open: (json['open'] as List<dynamic>)
          .map((e) => SupportBannerGrant.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$ClinicSupportGrantsToJson(
  ClinicSupportGrants instance,
) => <String, dynamic>{
  'grants': instance.grants,
  'now': instance.now.toIso8601String(),
  'open': instance.open,
};
