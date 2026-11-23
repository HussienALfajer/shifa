// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'clinic_status.dart';
import 'clinic_type.dart';

part 'create_clinic_request.g.dart';

@JsonSerializable()
class CreateClinicRequest {
  const CreateClinicRequest({
    required this.name,
    required this.ownerName,
    required this.ownerPhone,
    required this.status,
    required this.type,
    this.subscriptionEnd,
  });

  factory CreateClinicRequest.fromJson(Map<String, Object?> json) =>
      _$CreateClinicRequestFromJson(json);

  final String name;
  final String ownerName;
  final String ownerPhone;
  final ClinicStatus status;
  @JsonKey(includeIfNull: false)
  final String? subscriptionEnd;
  final ClinicType type;

  Map<String, Object?> toJson() => _$CreateClinicRequestToJson(this);
}
