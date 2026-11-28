// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'family_member.dart';

part 'patient_family.g.dart';

@JsonSerializable()
class PatientFamily {
  const PatientFamily({required this.holder, required this.members});

  factory PatientFamily.fromJson(Map<String, Object?> json) =>
      _$PatientFamilyFromJson(json);

  @JsonKey(includeIfNull: true)
  final FamilyMember? holder;
  final List<FamilyMember> members;

  Map<String, Object?> toJson() => _$PatientFamilyToJson(this);
}
