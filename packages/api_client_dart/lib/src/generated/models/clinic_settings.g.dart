// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_settings.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicSettings _$ClinicSettingsFromJson(Map<String, dynamic> json) =>
    ClinicSettings(
      idleMinutes: $enumDecode(_$IdleMinutesEnumMap, json['idleMinutes']),
      locked: json['locked'] as bool,
      source: $enumDecode(_$SettingSourceEnumMap, json['source']),
    );

Map<String, dynamic> _$ClinicSettingsToJson(ClinicSettings instance) =>
    <String, dynamic>{
      'idleMinutes': instance.idleMinutes,
      'locked': instance.locked,
      'source': instance.source,
    };

const _$IdleMinutesEnumMap = {
  IdleMinutes.value15: 15,
  IdleMinutes.value30: 30,
  IdleMinutes.value60: 60,
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
