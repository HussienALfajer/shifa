// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'entitlement_value.dart';

part 'entitlement_override.g.dart';

@JsonSerializable()
class EntitlementOverride {
  const EntitlementOverride({
    required this.expired,
    required this.expiresAt,
    required this.reason,
    required this.setAt,
    required this.setByName,
    required this.value,
  });

  factory EntitlementOverride.fromJson(Map<String, Object?> json) =>
      _$EntitlementOverrideFromJson(json);

  final bool expired;
  @JsonKey(includeIfNull: true)
  final String? expiresAt;
  final String reason;
  final DateTime setAt;
  @JsonKey(includeIfNull: true)
  final String? setByName;
  final EntitlementValue value;

  Map<String, Object?> toJson() => _$EntitlementOverrideToJson(this);
}
