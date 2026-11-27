// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'support_banner_grant.dart';
import 'support_grant_view.dart';

part 'clinic_support_grants.g.dart';

@JsonSerializable()
class ClinicSupportGrants {
  const ClinicSupportGrants({
    required this.grants,
    required this.now,
    required this.open,
  });

  factory ClinicSupportGrants.fromJson(Map<String, Object?> json) =>
      _$ClinicSupportGrantsFromJson(json);

  final List<SupportGrantView> grants;
  final DateTime now;
  final List<SupportBannerGrant> open;

  Map<String, Object?> toJson() => _$ClinicSupportGrantsToJson(this);
}
