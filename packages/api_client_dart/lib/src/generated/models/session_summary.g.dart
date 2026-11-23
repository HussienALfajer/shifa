// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session_summary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SessionSummary _$SessionSummaryFromJson(Map<String, dynamic> json) =>
    SessionSummary(
      browser: json['browser'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      current: json['current'] as bool,
      device: json['device'] as String?,
      id: json['id'] as String,
      lastActiveAt: DateTime.parse(json['lastActiveAt'] as String),
    );

Map<String, dynamic> _$SessionSummaryToJson(SessionSummary instance) =>
    <String, dynamic>{
      'browser': instance.browser,
      'createdAt': instance.createdAt.toIso8601String(),
      'current': instance.current,
      'device': instance.device,
      'id': instance.id,
      'lastActiveAt': instance.lastActiveAt.toIso8601String(),
    };
