// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_clinic.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MyClinic _$MyClinicFromJson(Map<String, dynamic> json) => MyClinic(
  branches: (json['branches'] as List<dynamic>)
      .map((e) => MyBranch.fromJson(e as Map<String, dynamic>))
      .toList(),
  lastActiveAt: json['lastActiveAt'] == null
      ? null
      : DateTime.parse(json['lastActiveAt'] as String),
  name: json['name'] as String,
  roles: (json['roles'] as List<dynamic>)
      .map((e) => $enumDecode(_$SessionRoleEnumMap, e))
      .toList(),
  selectable: json['selectable'] as bool,
  solo: json['solo'] as bool,
  status: $enumDecode(_$ClinicStatusEnumMap, json['status']),
  tenantId: json['tenantId'] as String,
);

Map<String, dynamic> _$MyClinicToJson(MyClinic instance) => <String, dynamic>{
  'branches': instance.branches,
  'lastActiveAt': instance.lastActiveAt?.toIso8601String(),
  'name': instance.name,
  'roles': instance.roles,
  'selectable': instance.selectable,
  'solo': instance.solo,
  'status': instance.status,
  'tenantId': instance.tenantId,
};

const _$SessionRoleEnumMap = {
  SessionRole.owner: 'owner',
  SessionRole.doctor: 'doctor',
  SessionRole.receptionist: 'receptionist',
  SessionRole.assistant: 'assistant',
  SessionRole.accountant: 'accountant',
};

const _$ClinicStatusEnumMap = {
  ClinicStatus.trial: 'trial',
  ClinicStatus.active: 'active',
  ClinicStatus.suspended: 'suspended',
};
