// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'my_clinic.dart';
import 'my_invitation.dart';

part 'my_clinics.g.dart';

@JsonSerializable()
class MyClinics {
  const MyClinics({required this.clinics, required this.invitations});

  factory MyClinics.fromJson(Map<String, Object?> json) =>
      _$MyClinicsFromJson(json);

  final List<MyClinic> clinics;
  final List<MyInvitation> invitations;

  Map<String, Object?> toJson() => _$MyClinicsToJson(this);
}
