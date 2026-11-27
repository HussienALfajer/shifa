// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'idle_minutes.dart';

part 'update_clinic_settings_request.g.dart';

@JsonSerializable()
class UpdateClinicSettingsRequest {
  const UpdateClinicSettingsRequest({required this.idleMinutes});

  factory UpdateClinicSettingsRequest.fromJson(Map<String, Object?> json) =>
      _$UpdateClinicSettingsRequestFromJson(json);

  final IdleMinutes idleMinutes;

  Map<String, Object?> toJson() => _$UpdateClinicSettingsRequestToJson(this);
}
