// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'clinic_owner.dart';
import 'clinic_status.dart';
import 'clinic_type.dart';

part 'clinic_detail.g.dart';

@JsonSerializable()
class ClinicDetail {
  const ClinicDetail({
    required this.createdAt,
    required this.id,
    required this.name,
    required this.owner,
    required this.ownerName,
    required this.status,
    required this.subscriptionEnd,
    required this.type,
  });

  factory ClinicDetail.fromJson(Map<String, Object?> json) =>
      _$ClinicDetailFromJson(json);

  final DateTime createdAt;
  final String id;
  final String name;
  @JsonKey(includeIfNull: true)
  final ClinicOwner? owner;
  @JsonKey(includeIfNull: true)
  final String? ownerName;
  final ClinicStatus status;
  @JsonKey(includeIfNull: true)
  final String? subscriptionEnd;
  final ClinicType type;

  Map<String, Object?> toJson() => _$ClinicDetailToJson(this);
}
