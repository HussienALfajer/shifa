// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'invitation_role.dart';

part 'my_invitation.g.dart';

@JsonSerializable()
class MyInvitation {
  const MyInvitation({
    required this.clinicName,
    required this.expiresAt,
    required this.id,
    required this.roles,
  });

  factory MyInvitation.fromJson(Map<String, Object?> json) =>
      _$MyInvitationFromJson(json);

  final String clinicName;
  final DateTime expiresAt;
  final String id;
  final List<InvitationRole> roles;

  Map<String, Object?> toJson() => _$MyInvitationToJson(this);
}
