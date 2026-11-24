// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'invitation_role.dart';

part 'invitation_view.g.dart';

@JsonSerializable()
class InvitationView {
  const InvitationView({
    required this.clinicName,
    required this.expiresAt,
    required this.personName,
    required this.phoneMasked,
    required this.roles,
  });

  factory InvitationView.fromJson(Map<String, Object?> json) =>
      _$InvitationViewFromJson(json);

  final String clinicName;
  final DateTime expiresAt;
  final String personName;
  final String phoneMasked;
  final List<InvitationRole> roles;

  Map<String, Object?> toJson() => _$InvitationViewToJson(this);
}
