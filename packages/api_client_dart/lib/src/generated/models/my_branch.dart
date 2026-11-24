// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'my_branch.g.dart';

@JsonSerializable()
class MyBranch {
  const MyBranch({required this.id, required this.name});

  factory MyBranch.fromJson(Map<String, Object?> json) =>
      _$MyBranchFromJson(json);

  final String id;
  final String name;

  Map<String, Object?> toJson() => _$MyBranchToJson(this);
}
