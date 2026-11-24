// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'branch_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BranchList _$BranchListFromJson(Map<String, dynamic> json) => BranchList(
  active: (json['active'] as List<dynamic>)
      .map((e) => Branch.fromJson(e as Map<String, dynamic>))
      .toList(),
  archived: (json['archived'] as List<dynamic>)
      .map((e) => Branch.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$BranchListToJson(BranchList instance) =>
    <String, dynamic>{'active': instance.active, 'archived': instance.archived};
