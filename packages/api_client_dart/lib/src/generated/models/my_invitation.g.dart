// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_invitation.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MyInvitation _$MyInvitationFromJson(Map<String, dynamic> json) => MyInvitation(
  clinicName: json['clinicName'] as String,
  expiresAt: DateTime.parse(json['expiresAt'] as String),
  id: json['id'] as String,
  roles: (json['roles'] as List<dynamic>)
      .map((e) => InvitationRole.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$MyInvitationToJson(MyInvitation instance) =>
    <String, dynamic>{
      'clinicName': instance.clinicName,
      'expiresAt': instance.expiresAt.toIso8601String(),
      'id': instance.id,
      'roles': instance.roles,
    };
