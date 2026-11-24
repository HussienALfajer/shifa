// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'switch_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SwitchRequest _$SwitchRequestFromJson(Map<String, dynamic> json) =>
    SwitchRequest(
      tenantId: json['tenantId'] as String,
      branchId: json['branchId'] as String?,
    );

Map<String, dynamic> _$SwitchRequestToJson(SwitchRequest instance) =>
    <String, dynamic>{
      'branchId': ?instance.branchId,
      'tenantId': instance.tenantId,
    };
