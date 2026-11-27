// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'override_event.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OverrideEvent _$OverrideEventFromJson(Map<String, dynamic> json) =>
    OverrideEvent(
      after: json['after'] == null
          ? null
          : OverrideState.fromJson(json['after'] as Map<String, dynamic>),
      at: DateTime.parse(json['at'] as String),
      before: json['before'] == null
          ? null
          : OverrideState.fromJson(json['before'] as Map<String, dynamic>),
      byName: json['byName'] as String?,
      kind: $enumDecode(_$OverrideEventKindEnumMap, json['kind']),
      reason: json['reason'] as String?,
    );

Map<String, dynamic> _$OverrideEventToJson(OverrideEvent instance) =>
    <String, dynamic>{
      'after': instance.after,
      'at': instance.at.toIso8601String(),
      'before': instance.before,
      'byName': instance.byName,
      'kind': instance.kind,
      'reason': instance.reason,
    };

const _$OverrideEventKindEnumMap = {
  OverrideEventKind.valueSet: 'set',
  OverrideEventKind.changed: 'changed',
  OverrideEventKind.removed: 'removed',
  OverrideEventKind.expired: 'expired',
  OverrideEventKind.typeChanged: 'type_changed',
};
