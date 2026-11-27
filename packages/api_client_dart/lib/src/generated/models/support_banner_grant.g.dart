// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'support_banner_grant.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupportBannerGrant _$SupportBannerGrantFromJson(Map<String, dynamic> json) =>
    SupportBannerGrant(
      adminName: json['adminName'] as String,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      id: json['id'] as String,
      reason: json['reason'] as String,
    );

Map<String, dynamic> _$SupportBannerGrantToJson(SupportBannerGrant instance) =>
    <String, dynamic>{
      'adminName': instance.adminName,
      'expiresAt': instance.expiresAt.toIso8601String(),
      'id': instance.id,
      'reason': instance.reason,
    };
