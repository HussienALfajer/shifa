// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'member_detail.dart';
import 'member_link_issued.dart';

part 'member_added.g.dart';

@JsonSerializable()
class MemberAdded {
  const MemberAdded({required this.link, required this.member});

  factory MemberAdded.fromJson(Map<String, Object?> json) =>
      _$MemberAddedFromJson(json);

  final MemberLinkIssued link;
  final MemberDetail member;

  Map<String, Object?> toJson() => _$MemberAddedToJson(this);
}
