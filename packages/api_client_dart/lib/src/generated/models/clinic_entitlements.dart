// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'clinic_type.dart';
import 'entitlement_item.dart';

part 'clinic_entitlements.g.dart';

@JsonSerializable()
class ClinicEntitlements {
  const ClinicEntitlements({required this.items, required this.plan});

  factory ClinicEntitlements.fromJson(Map<String, Object?> json) =>
      _$ClinicEntitlementsFromJson(json);

  final List<EntitlementItem> items;
  final ClinicType plan;

  Map<String, Object?> toJson() => _$ClinicEntitlementsToJson(this);
}
