// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'area.g.dart';

@JsonSerializable()
class Area {
  const Area({
    required this.archivedAt,
    required this.branchCount,
    required this.cityId,
    required this.clinicCount,
    required this.doctorCount,
    required this.id,
    required this.name,
  });

  factory Area.fromJson(Map<String, Object?> json) => _$AreaFromJson(json);

  @JsonKey(includeIfNull: true)
  final DateTime? archivedAt;
  final int branchCount;
  final String cityId;
  final int clinicCount;
  final int doctorCount;
  final String id;
  final String name;

  Map<String, Object?> toJson() => _$AreaToJson(this);
}
