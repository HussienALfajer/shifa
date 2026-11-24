// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'member_detail.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MemberDetail _$MemberDetailFromJson(Map<String, dynamic> json) => MemberDetail(
  id: json['id'] as String,
  isLastOwner: json['isLastOwner'] as bool,
  lastActiveAt: json['lastActiveAt'] == null
      ? null
      : DateTime.parse(json['lastActiveAt'] as String),
  mfaEnrolled: json['mfaEnrolled'] as bool,
  name: json['name'] as String,
  permissions: (json['permissions'] as List<dynamic>)
      .map((e) => MemberPermission.fromJson(e as Map<String, dynamic>))
      .toList(),
  phone: json['phone'] as String,
  roles: (json['roles'] as List<dynamic>)
      .map((e) => MemberRole.fromJson(e as Map<String, dynamic>))
      .toList(),
  status: $enumDecode(_$MembershipStatusEnumMap, json['status']),
);

Map<String, dynamic> _$MemberDetailToJson(MemberDetail instance) =>
    <String, dynamic>{
      'id': instance.id,
      'isLastOwner': instance.isLastOwner,
      'lastActiveAt': instance.lastActiveAt?.toIso8601String(),
      'mfaEnrolled': instance.mfaEnrolled,
      'name': instance.name,
      'permissions': instance.permissions,
      'phone': instance.phone,
      'roles': instance.roles,
      'status': instance.status,
    };

const _$MembershipStatusEnumMap = {
  MembershipStatus.pending: 'pending',
  MembershipStatus.active: 'active',
  MembershipStatus.deactivated: 'deactivated',
};
