// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'setting_source.dart';

part 'setting_view.g.dart';

@JsonSerializable()
class SettingView {
  const SettingView({
    required this.choices,
    required this.key,
    required this.lockable,
    required this.locked,
    required this.lockedBy,
    required this.source,
    required this.value,
  });

  factory SettingView.fromJson(Map<String, Object?> json) =>
      _$SettingViewFromJson(json);

  @JsonKey(includeIfNull: true)
  final List<dynamic>? choices;
  final String key;
  final bool lockable;
  final bool locked;
  @JsonKey(includeIfNull: true)
  final SettingSource? lockedBy;
  final SettingSource source;
  final dynamic value;

  Map<String, Object?> toJson() => _$SettingViewToJson(this);
}
