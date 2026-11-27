// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'type_preview_limit.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TypePreviewLimit _$TypePreviewLimitFromJson(Map<String, dynamic> json) =>
    TypePreviewLimit(
      current: json['current'] as num,
      key: json['key'] as String,
      next: json['next'] as num,
      over: json['over'] as bool,
      used: json['used'] as num,
    );

Map<String, dynamic> _$TypePreviewLimitToJson(TypePreviewLimit instance) =>
    <String, dynamic>{
      'current': instance.current,
      'key': instance.key,
      'next': instance.next,
      'over': instance.over,
      'used': instance.used,
    };
