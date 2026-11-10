// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'health_status.g.dart';

@JsonSerializable()
class HealthStatus {
  const HealthStatus({required this.status});

  factory HealthStatus.fromJson(Map<String, Object?> json) =>
      _$HealthStatusFromJson(json);

  final String status;

  Map<String, Object?> toJson() => _$HealthStatusToJson(this);
}
