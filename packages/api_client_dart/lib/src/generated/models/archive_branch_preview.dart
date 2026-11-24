// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'archived_member.dart';

part 'archive_branch_preview.g.dart';

@JsonSerializable()
class ArchiveBranchPreview {
  const ArchiveBranchPreview({required this.lastBranch, required this.members});

  factory ArchiveBranchPreview.fromJson(Map<String, Object?> json) =>
      _$ArchiveBranchPreviewFromJson(json);

  final bool lastBranch;
  final List<ArchivedMember> members;

  Map<String, Object?> toJson() => _$ArchiveBranchPreviewToJson(this);
}
