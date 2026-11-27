// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'entitlement_value.dart';

part 'set_override_request.g.dart';

@JsonSerializable()
class SetOverrideRequest {
  const SetOverrideRequest({
    required this.reason,
    required this.value,
    this.expiresAt,
  });

  factory SetOverrideRequest.fromJson(Map<String, Object?> json) =>
      _$SetOverrideRequestFromJson(json);

  @JsonKey(includeIfNull: false)
  final String? expiresAt;
  final String reason;
  final EntitlementValue value;

  Map<String, Object?> toJson() => _$SetOverrideRequestToJson(this);
}
