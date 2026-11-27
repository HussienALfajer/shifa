// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'usage_totals.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UsageTotals _$UsageTotalsFromJson(Map<String, dynamic> json) => UsageTotals(
  membersSignedIn: (json['membersSignedIn'] as num).toInt(),
  signIns: (json['signIns'] as num).toInt(),
);

Map<String, dynamic> _$UsageTotalsToJson(UsageTotals instance) =>
    <String, dynamic>{
      'membersSignedIn': instance.membersSignedIn,
      'signIns': instance.signIns,
    };
