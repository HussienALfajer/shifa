// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'member_summary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MemberSummary _$MemberSummaryFromJson(Map<String, dynamic> json) =>
    MemberSummary(
      id: json['id'] as String,
      isSelf: json['isSelf'] as bool,
      lastActiveAt: json['lastActiveAt'] == null
          ? null
          : DateTime.parse(json['lastActiveAt'] as String),
      linkExpiresAt: json['linkExpiresAt'] == null
          ? null
          : DateTime.parse(json['linkExpiresAt'] as String),
      name: json['name'] as String,
      phone: json['phone'] as String,
      roles: (json['roles'] as List<dynamic>)
          .map((e) => MemberRole.fromJson(e as Map<String, dynamic>))
          .toList(),
      status: $enumDecode(_$MembershipStatusEnumMap, json['status']),
    );

Map<String, dynamic> _$MemberSummaryToJson(MemberSummary instance) =>
    <String, dynamic>{
      'id': instance.id,
      'isSelf': instance.isSelf,
      'lastActiveAt': instance.lastActiveAt?.toIso8601String(),
      'linkExpiresAt': instance.linkExpiresAt?.toIso8601String(),
      'name': instance.name,
      'phone': instance.phone,
      'roles': instance.roles,
      'status': instance.status,
    };

const _$MembershipStatusEnumMap = {
  MembershipStatus.pending: 'pending',
  MembershipStatus.active: 'active',
  MembershipStatus.deactivated: 'deactivated',
};
