// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SessionList _$SessionListFromJson(Map<String, dynamic> json) => SessionList(
  sessions: (json['sessions'] as List<dynamic>)
      .map((e) => SessionSummary.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$SessionListToJson(SessionList instance) =>
    <String, dynamic>{'sessions': instance.sessions};
