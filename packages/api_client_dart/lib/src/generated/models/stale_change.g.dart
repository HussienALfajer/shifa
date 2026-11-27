// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stale_change.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StaleChange _$StaleChangeFromJson(Map<String, dynamic> json) => StaleChange(
  updatedAt: DateTime.parse(json['updatedAt'] as String),
  updatedByName: json['updatedByName'] as String?,
);

Map<String, dynamic> _$StaleChangeToJson(StaleChange instance) =>
    <String, dynamic>{
      'updatedAt': instance.updatedAt.toIso8601String(),
      'updatedByName': instance.updatedByName,
    };
