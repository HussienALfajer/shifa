// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'setting_view.dart';

part 'clinic_setting_list.g.dart';

@JsonSerializable()
class ClinicSettingList {
  const ClinicSettingList({required this.settings});

  factory ClinicSettingList.fromJson(Map<String, Object?> json) =>
      _$ClinicSettingListFromJson(json);

  final List<SettingView> settings;

  Map<String, Object?> toJson() => _$ClinicSettingListToJson(this);
}
