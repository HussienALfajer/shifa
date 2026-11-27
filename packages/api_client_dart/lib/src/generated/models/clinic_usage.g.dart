// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_usage.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicUsage _$ClinicUsageFromJson(Map<String, dynamic> json) => ClinicUsage(
  branches: (json['branches'] as num).toInt(),
  days: (json['days'] as List<dynamic>)
      .map((e) => UsageDay.fromJson(e as Map<String, dynamic>))
      .toList(),
  hasData: json['hasData'] as bool,
  lastActivityAt: json['lastActivityAt'] == null
      ? null
      : DateTime.parse(json['lastActivityAt'] as String),
  members: (json['members'] as num).toInt(),
  previousTotals: UsageTotals.fromJson(
    json['previousTotals'] as Map<String, dynamic>,
  ),
  today: json['today'] as String,
  todayCounts: UsageTodayCounts.fromJson(
    json['todayCounts'] as Map<String, dynamic>,
  ),
);

Map<String, dynamic> _$ClinicUsageToJson(ClinicUsage instance) =>
    <String, dynamic>{
      'branches': instance.branches,
      'days': instance.days,
      'hasData': instance.hasData,
      'lastActivityAt': instance.lastActivityAt?.toIso8601String(),
      'members': instance.members,
      'previousTotals': instance.previousTotals,
      'today': instance.today,
      'todayCounts': instance.todayCounts,
    };
