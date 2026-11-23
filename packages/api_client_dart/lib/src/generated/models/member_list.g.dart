// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'member_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MemberList _$MemberListFromJson(Map<String, dynamic> json) => MemberList(
  members: (json['members'] as List<dynamic>)
      .map((e) => MemberSummary.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$MemberListToJson(MemberList instance) =>
    <String, dynamic>{'members': instance.members};
