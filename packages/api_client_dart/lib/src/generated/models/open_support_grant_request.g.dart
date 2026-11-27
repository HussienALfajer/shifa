// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'open_support_grant_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OpenSupportGrantRequest _$OpenSupportGrantRequestFromJson(
  Map<String, dynamic> json,
) => OpenSupportGrantRequest(
  minutes: (json['minutes'] as num).toInt(),
  reason: json['reason'] as String,
);

Map<String, dynamic> _$OpenSupportGrantRequestToJson(
  OpenSupportGrantRequest instance,
) => <String, dynamic>{'minutes': instance.minutes, 'reason': instance.reason};
