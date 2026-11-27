// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'usage_today_counts.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UsageTodayCounts _$UsageTodayCountsFromJson(Map<String, dynamic> json) =>
    UsageTodayCounts(
      activeBranches: (json['activeBranches'] as num).toInt(),
      activeMembers: (json['activeMembers'] as num).toInt(),
      membersSignedIn: (json['membersSignedIn'] as num).toInt(),
      signIns: (json['signIns'] as num).toInt(),
    );

Map<String, dynamic> _$UsageTodayCountsToJson(UsageTodayCounts instance) =>
    <String, dynamic>{
      'activeBranches': instance.activeBranches,
      'activeMembers': instance.activeMembers,
      'membersSignedIn': instance.membersSignedIn,
      'signIns': instance.signIns,
    };
