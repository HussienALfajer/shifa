// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'branch_place.g.dart';

@JsonSerializable()
class BranchPlace {
  const BranchPlace({
    required this.archived,
    required this.id,
    required this.name,
  });

  factory BranchPlace.fromJson(Map<String, Object?> json) =>
      _$BranchPlaceFromJson(json);

  final bool archived;
  final String id;
  final String name;

  Map<String, Object?> toJson() => _$BranchPlaceToJson(this);
}
