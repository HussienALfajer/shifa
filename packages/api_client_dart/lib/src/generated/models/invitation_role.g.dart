// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invitation_role.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InvitationRole _$InvitationRoleFromJson(Map<String, dynamic> json) =>
    InvitationRole(
      branchName: json['branchName'] as String?,
      role: $enumDecode(_$SessionRoleEnumMap, json['role']),
    );

Map<String, dynamic> _$InvitationRoleToJson(InvitationRole instance) =>
    <String, dynamic>{'branchName': instance.branchName, 'role': instance.role};

const _$SessionRoleEnumMap = {
  SessionRole.owner: 'owner',
  SessionRole.doctor: 'doctor',
  SessionRole.receptionist: 'receptionist',
  SessionRole.assistant: 'assistant',
  SessionRole.accountant: 'accountant',
};
