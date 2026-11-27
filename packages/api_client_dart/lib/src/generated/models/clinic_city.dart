// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'clinic_area.dart';

part 'clinic_city.g.dart';

@JsonSerializable()
class ClinicCity {
  const ClinicCity({
    required this.archived,
    required this.areas,
    required this.id,
    required this.name,
  });

  factory ClinicCity.fromJson(Map<String, Object?> json) =>
      _$ClinicCityFromJson(json);

  final bool archived;
  final List<ClinicArea> areas;
  final String id;
  final String name;

  Map<String, Object?> toJson() => _$ClinicCityToJson(this);
}
