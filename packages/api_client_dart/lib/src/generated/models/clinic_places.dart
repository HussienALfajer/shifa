// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'clinic_city.dart';

part 'clinic_places.g.dart';

@JsonSerializable()
class ClinicPlaces {
  const ClinicPlaces({required this.cities});

  factory ClinicPlaces.fromJson(Map<String, Object?> json) =>
      _$ClinicPlacesFromJson(json);

  final List<ClinicCity> cities;

  Map<String, Object?> toJson() => _$ClinicPlacesToJson(this);
}
