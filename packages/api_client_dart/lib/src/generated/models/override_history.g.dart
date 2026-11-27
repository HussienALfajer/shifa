// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'override_history.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OverrideHistory _$OverrideHistoryFromJson(Map<String, dynamic> json) =>
    OverrideHistory(
      events: (json['events'] as List<dynamic>)
          .map((e) => OverrideEvent.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$OverrideHistoryToJson(OverrideHistory instance) =>
    <String, dynamic>{'events': instance.events};
