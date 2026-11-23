// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'member_summary.dart';

part 'member_list.g.dart';

@JsonSerializable()
class MemberList {
  const MemberList({required this.members});

  factory MemberList.fromJson(Map<String, Object?> json) =>
      _$MemberListFromJson(json);

  final List<MemberSummary> members;

  Map<String, Object?> toJson() => _$MemberListToJson(this);
}
