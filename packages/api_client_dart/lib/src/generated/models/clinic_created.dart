// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'clinic_detail.dart';
import 'setup_link_issued.dart';

part 'clinic_created.g.dart';

@JsonSerializable()
class ClinicCreated {
  const ClinicCreated({required this.clinic, required this.ownerLink});

  factory ClinicCreated.fromJson(Map<String, Object?> json) =>
      _$ClinicCreatedFromJson(json);

  final ClinicDetail clinic;
  final SetupLinkIssued ownerLink;

  Map<String, Object?> toJson() => _$ClinicCreatedToJson(this);
}
