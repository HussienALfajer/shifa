// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_settings.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicSettings _$ClinicSettingsFromJson(Map<String, dynamic> json) =>
    ClinicSettings(
      idleMinutes: $enumDecode(_$IdleMinutesEnumMap, json['idleMinutes']),
    );

Map<String, dynamic> _$ClinicSettingsToJson(ClinicSettings instance) =>
    <String, dynamic>{'idleMinutes': instance.idleMinutes};

const _$IdleMinutesEnumMap = {
  IdleMinutes.value15: 15,
  IdleMinutes.value30: 30,
  IdleMinutes.value60: 60,
};
