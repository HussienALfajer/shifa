// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'area.dart';

part 'city.g.dart';

@JsonSerializable()
class City {
  const City({
    required this.archivedAt,
    required this.areas,
    required this.branchCount,
    required this.clinicCount,
    required this.doctorCount,
    required this.id,
    required this.name,
  });

  factory City.fromJson(Map<String, Object?> json) => _$CityFromJson(json);

  @JsonKey(includeIfNull: true)
  final DateTime? archivedAt;
  final List<Area> areas;
  final int branchCount;
  final int clinicCount;
  final int doctorCount;
  final String id;
  final String name;

  Map<String, Object?> toJson() => _$CityToJson(this);
}
