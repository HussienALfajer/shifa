// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'membership_status.dart';

part 'clinic_owner.g.dart';

@JsonSerializable()
class ClinicOwner {
  const ClinicOwner({
    required this.linkExpiresAt,
    required this.membershipId,
    required this.name,
    required this.phoneMasked,
    required this.status,
  });

  factory ClinicOwner.fromJson(Map<String, Object?> json) =>
      _$ClinicOwnerFromJson(json);

  @JsonKey(includeIfNull: true)
  final DateTime? linkExpiresAt;
  final String membershipId;
  final String name;
  final String phoneMasked;
  final MembershipStatus status;

  Map<String, Object?> toJson() => _$ClinicOwnerToJson(this);
}
