// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'clinic_area.g.dart';

@JsonSerializable()
class ClinicArea {
  const ClinicArea({
    required this.archived,
    required this.id,
    required this.name,
  });

  factory ClinicArea.fromJson(Map<String, Object?> json) =>
      _$ClinicAreaFromJson(json);

  final bool archived;
  final String id;
  final String name;

  Map<String, Object?> toJson() => _$ClinicAreaToJson(this);
}
