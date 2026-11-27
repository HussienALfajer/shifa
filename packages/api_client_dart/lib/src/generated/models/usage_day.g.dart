// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'usage_day.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UsageDay _$UsageDayFromJson(Map<String, dynamic> json) => UsageDay(
  date: json['date'] as String,
  membersSignedIn: (json['membersSignedIn'] as num).toInt(),
  signIns: (json['signIns'] as num).toInt(),
);

Map<String, dynamic> _$UsageDayToJson(UsageDay instance) => <String, dynamic>{
  'date': instance.date,
  'membersSignedIn': instance.membersSignedIn,
  'signIns': instance.signIns,
};
