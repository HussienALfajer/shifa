// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'idle_minutes.dart';
import 'setting_source.dart';

part 'clinic_settings.g.dart';

@JsonSerializable()
class ClinicSettings {
  const ClinicSettings({
    required this.idleMinutes,
    required this.locked,
    required this.source,
  });

  factory ClinicSettings.fromJson(Map<String, Object?> json) =>
      _$ClinicSettingsFromJson(json);

  final IdleMinutes idleMinutes;
  final bool locked;
  final SettingSource source;

  Map<String, Object?> toJson() => _$ClinicSettingsToJson(this);
}
