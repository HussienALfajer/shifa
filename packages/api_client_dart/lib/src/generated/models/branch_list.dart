// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'branch.dart';

part 'branch_list.g.dart';

@JsonSerializable()
class BranchList {
  const BranchList({required this.active, required this.archived});

  factory BranchList.fromJson(Map<String, Object?> json) =>
      _$BranchListFromJson(json);

  final List<Branch> active;
  final List<Branch> archived;

  Map<String, Object?> toJson() => _$BranchListToJson(this);
}
