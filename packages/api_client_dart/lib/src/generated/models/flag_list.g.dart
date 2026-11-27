// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'flag_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FlagList _$FlagListFromJson(Map<String, dynamic> json) => FlagList(
  flags: (json['flags'] as List<dynamic>)
      .map((e) => FlagView.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$FlagListToJson(FlagList instance) => <String, dynamic>{
  'flags': instance.flags,
};
