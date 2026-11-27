// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'support_session_view.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupportSessionView _$SupportSessionViewFromJson(Map<String, dynamic> json) =>
    SupportSessionView(
      clinicName: json['clinicName'] as String,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      grantId: json['grantId'] as String,
      now: DateTime.parse(json['now'] as String),
      reason: json['reason'] as String,
    );

Map<String, dynamic> _$SupportSessionViewToJson(SupportSessionView instance) =>
    <String, dynamic>{
      'clinicName': instance.clinicName,
      'expiresAt': instance.expiresAt.toIso8601String(),
      'grantId': instance.grantId,
      'now': instance.now.toIso8601String(),
      'reason': instance.reason,
    };
