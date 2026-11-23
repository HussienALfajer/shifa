// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'idle_minutes.dart';

part 'clinic_settings.g.dart';

@JsonSerializable()
class ClinicSettings {
  const ClinicSettings({required this.idleMinutes});

  factory ClinicSettings.fromJson(Map<String, Object?> json) =>
      _$ClinicSettingsFromJson(json);

  final IdleMinutes idleMinutes;

  Map<String, Object?> toJson() => _$ClinicSettingsToJson(this);
}
