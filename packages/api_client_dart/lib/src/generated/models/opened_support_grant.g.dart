// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'opened_support_grant.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OpenedSupportGrant _$OpenedSupportGrantFromJson(Map<String, dynamic> json) =>
    OpenedSupportGrant(
      grant: SupportGrantView.fromJson(json['grant'] as Map<String, dynamic>),
      handoffUrl: json['handoffUrl'] as String,
    );

Map<String, dynamic> _$OpenedSupportGrantToJson(OpenedSupportGrant instance) =>
    <String, dynamic>{
      'grant': instance.grant,
      'handoffUrl': instance.handoffUrl,
    };
