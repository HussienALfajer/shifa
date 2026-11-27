// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'flag_view.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FlagView _$FlagViewFromJson(Map<String, dynamic> json) => FlagView(
  clinics: (json['clinics'] as List<dynamic>)
      .map((e) => FlagClinic.fromJson(e as Map<String, dynamic>))
      .toList(),
  defaultValue: json['defaultValue'] as bool,
  description: json['description'] as String,
  key: json['key'] as String,
  mode: $enumDecode(_$FlagModeEnumMap, json['mode']),
  reason: json['reason'] as String?,
  updatedAt: json['updatedAt'] == null
      ? null
      : DateTime.parse(json['updatedAt'] as String),
  updatedByName: json['updatedByName'] as String?,
);

Map<String, dynamic> _$FlagViewToJson(FlagView instance) => <String, dynamic>{
  'clinics': instance.clinics,
  'defaultValue': instance.defaultValue,
  'description': instance.description,
  'key': instance.key,
  'mode': instance.mode,
  'reason': instance.reason,
  'updatedAt': instance.updatedAt?.toIso8601String(),
  'updatedByName': instance.updatedByName,
};

const _$FlagModeEnumMap = {
  FlagMode.off: 'off',
  FlagMode.valueOn: 'on',
  FlagMode.selected: 'selected',
};
