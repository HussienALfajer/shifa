// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'member_added.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MemberAdded _$MemberAddedFromJson(Map<String, dynamic> json) => MemberAdded(
  link: MemberLinkIssued.fromJson(json['link'] as Map<String, dynamic>),
  member: MemberDetail.fromJson(json['member'] as Map<String, dynamic>),
);

Map<String, dynamic> _$MemberAddedToJson(MemberAdded instance) =>
    <String, dynamic>{'link': instance.link, 'member': instance.member};
