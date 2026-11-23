// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'member_role.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MemberRole _$MemberRoleFromJson(Map<String, dynamic> json) => MemberRole(
  branchId: json['branchId'] as String?,
  branchName: json['branchName'] as String?,
  role: $enumDecode(_$SessionRoleEnumMap, json['role']),
);

Map<String, dynamic> _$MemberRoleToJson(MemberRole instance) =>
    <String, dynamic>{
      'branchId': instance.branchId,
      'branchName': instance.branchName,
      'role': instance.role,
    };

const _$SessionRoleEnumMap = {
  SessionRole.owner: 'owner',
  SessionRole.doctor: 'doctor',
  SessionRole.receptionist: 'receptionist',
  SessionRole.assistant: 'assistant',
  SessionRole.accountant: 'accountant',
};
