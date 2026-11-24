// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'archive_branch_preview.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ArchiveBranchPreview _$ArchiveBranchPreviewFromJson(
  Map<String, dynamic> json,
) => ArchiveBranchPreview(
  lastBranch: json['lastBranch'] as bool,
  members: (json['members'] as List<dynamic>)
      .map((e) => ArchivedMember.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$ArchiveBranchPreviewToJson(
  ArchiveBranchPreview instance,
) => <String, dynamic>{
  'lastBranch': instance.lastBranch,
  'members': instance.members,
};
