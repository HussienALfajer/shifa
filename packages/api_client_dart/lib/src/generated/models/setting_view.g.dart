// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'setting_view.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SettingView _$SettingViewFromJson(Map<String, dynamic> json) => SettingView(
  choices: json['choices'] as List<dynamic>?,
  key: json['key'] as String,
  lockable: json['lockable'] as bool,
  locked: json['locked'] as bool,
  lockedBy: $enumDecodeNullable(_$SettingSourceEnumMap, json['lockedBy']),
  source: $enumDecode(_$SettingSourceEnumMap, json['source']),
  value: json['value'],
);

Map<String, dynamic> _$SettingViewToJson(SettingView instance) =>
    <String, dynamic>{
      'choices': instance.choices,
      'key': instance.key,
      'lockable': instance.lockable,
      'locked': instance.locked,
      'lockedBy': instance.lockedBy,
      'source': instance.source,
      'value': ?instance.value,
    };

const _$SettingSourceEnumMap = {
  SettingSource.valueDefault: 'default',
  SettingSource.platform: 'platform',
  SettingSource.plan: 'plan',
  SettingSource.specialtyPack: 'specialty_pack',
  SettingSource.organization: 'organization',
  SettingSource.branch: 'branch',
  SettingSource.practitioner: 'practitioner',
  SettingSource.user: 'user',
};
