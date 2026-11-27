// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_clinic_settings_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateClinicSettingsRequest _$UpdateClinicSettingsRequestFromJson(
  Map<String, dynamic> json,
) => UpdateClinicSettingsRequest(
  idleMinutes: $enumDecode(_$IdleMinutesEnumMap, json['idleMinutes']),
);

Map<String, dynamic> _$UpdateClinicSettingsRequestToJson(
  UpdateClinicSettingsRequest instance,
) => <String, dynamic>{'idleMinutes': instance.idleMinutes};

const _$IdleMinutesEnumMap = {
  IdleMinutes.value15: 15,
  IdleMinutes.value30: 30,
  IdleMinutes.value60: 60,
};
