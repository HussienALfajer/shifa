// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'limit_use.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LimitUse _$LimitUseFromJson(Map<String, dynamic> json) => LimitUse(
  key: json['key'] as String,
  limit: (json['limit'] as num).toInt(),
  used: (json['used'] as num?)?.toInt(),
);

Map<String, dynamic> _$LimitUseToJson(LimitUse instance) => <String, dynamic>{
  'key': instance.key,
  'limit': instance.limit,
  'used': instance.used,
};
