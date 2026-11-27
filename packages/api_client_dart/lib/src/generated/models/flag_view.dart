// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'flag_clinic.dart';
import 'flag_mode.dart';

part 'flag_view.g.dart';

@JsonSerializable()
class FlagView {
  const FlagView({
    required this.clinics,
    required this.defaultValue,
    required this.description,
    required this.key,
    required this.mode,
    required this.reason,
    required this.updatedAt,
    required this.updatedByName,
  });

  factory FlagView.fromJson(Map<String, Object?> json) =>
      _$FlagViewFromJson(json);

  final List<FlagClinic> clinics;
  final bool defaultValue;
  final String description;
  final String key;
  final FlagMode mode;
  @JsonKey(includeIfNull: true)
  final String? reason;
  @JsonKey(includeIfNull: true)
  final DateTime? updatedAt;
  @JsonKey(includeIfNull: true)
  final String? updatedByName;

  Map<String, Object?> toJson() => _$FlagViewToJson(this);
}
