// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'archived_member.g.dart';

@JsonSerializable()
class ArchivedMember {
  const ArchivedMember({required this.id, required this.name});

  factory ArchivedMember.fromJson(Map<String, Object?> json) =>
      _$ArchivedMemberFromJson(json);

  final String id;
  final String name;

  Map<String, Object?> toJson() => _$ArchivedMemberToJson(this);
}
