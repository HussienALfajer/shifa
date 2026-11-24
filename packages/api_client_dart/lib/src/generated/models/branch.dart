// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'branch.g.dart';

@JsonSerializable()
class Branch {
  const Branch({
    required this.address,
    required this.archivedAt,
    required this.id,
    required this.memberCount,
    required this.name,
    required this.phone,
  });

  factory Branch.fromJson(Map<String, Object?> json) => _$BranchFromJson(json);

  @JsonKey(includeIfNull: true)
  final String? address;
  @JsonKey(includeIfNull: true)
  final DateTime? archivedAt;
  final String id;
  final int memberCount;
  final String name;
  @JsonKey(includeIfNull: true)
  final String? phone;

  Map<String, Object?> toJson() => _$BranchToJson(this);
}
