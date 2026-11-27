// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'set_override_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SetOverrideRequest _$SetOverrideRequestFromJson(Map<String, dynamic> json) =>
    SetOverrideRequest(
      reason: json['reason'] as String,
      value: json['value'],
      expiresAt: json['expiresAt'] as String?,
    );

Map<String, dynamic> _$SetOverrideRequestToJson(SetOverrideRequest instance) =>
    <String, dynamic>{
      'expiresAt': ?instance.expiresAt,
      'reason': instance.reason,
      'value': ?instance.value,
    };
