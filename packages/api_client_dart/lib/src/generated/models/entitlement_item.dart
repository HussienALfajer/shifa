// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'entitlement_kind.dart';
import 'entitlement_override.dart';
import 'entitlement_value.dart';

part 'entitlement_item.g.dart';

@JsonSerializable()
class EntitlementItem {
  const EntitlementItem({
    required this.effective,
    required this.key,
    required this.kind,
    required this.override,
    required this.planValue,
  });

  factory EntitlementItem.fromJson(Map<String, Object?> json) =>
      _$EntitlementItemFromJson(json);

  final EntitlementValue effective;
  final String key;
  final EntitlementKind kind;
  @JsonKey(includeIfNull: true)
  final EntitlementOverride? override;
  final EntitlementValue planValue;

  Map<String, Object?> toJson() => _$EntitlementItemToJson(this);
}
