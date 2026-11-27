// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'limit_reached.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LimitReached _$LimitReachedFromJson(Map<String, dynamic> json) => LimitReached(
  key: json['key'] as String,
  limit: (json['limit'] as num).toInt(),
  used: (json['used'] as num).toInt(),
);

Map<String, dynamic> _$LimitReachedToJson(LimitReached instance) =>
    <String, dynamic>{
      'key': instance.key,
      'limit': instance.limit,
      'used': instance.used,
    };
