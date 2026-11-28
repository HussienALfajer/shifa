// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'patient_family_request.g.dart';

@JsonSerializable()
class PatientFamilyRequest {
  const PatientFamilyRequest({required this.phone, this.excludeId});

  factory PatientFamilyRequest.fromJson(Map<String, Object?> json) =>
      _$PatientFamilyRequestFromJson(json);

  @JsonKey(includeIfNull: false)
  final String? excludeId;
  final String phone;

  Map<String, Object?> toJson() => _$PatientFamilyRequestToJson(this);
}
