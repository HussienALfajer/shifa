// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_age.dart';

part 'duplicate_check_request.g.dart';

@JsonSerializable()
class DuplicateCheckRequest {
  const DuplicateCheckRequest({
    this.age,
    this.birthDate,
    this.contactPhone,
    this.excludeId,
    this.familyName,
    this.fatherName,
    this.givenName,
  });

  factory DuplicateCheckRequest.fromJson(Map<String, Object?> json) =>
      _$DuplicateCheckRequestFromJson(json);

  @JsonKey(includeIfNull: false)
  final PatientAge? age;
  @JsonKey(includeIfNull: false)
  final String? birthDate;
  @JsonKey(includeIfNull: false)
  final String? contactPhone;
  @JsonKey(includeIfNull: false)
  final String? excludeId;
  @JsonKey(includeIfNull: false)
  final String? familyName;
  @JsonKey(includeIfNull: false)
  final String? fatherName;
  @JsonKey(includeIfNull: false)
  final String? givenName;

  Map<String, Object?> toJson() => _$DuplicateCheckRequestToJson(this);
}
