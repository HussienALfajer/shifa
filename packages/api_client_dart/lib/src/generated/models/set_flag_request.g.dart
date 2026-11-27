// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'set_flag_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SetFlagRequest _$SetFlagRequestFromJson(Map<String, dynamic> json) =>
    SetFlagRequest(
      mode: $enumDecode(_$FlagModeEnumMap, json['mode']),
      reason: json['reason'] as String,
      clinicIds: (json['clinicIds'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
    );

Map<String, dynamic> _$SetFlagRequestToJson(SetFlagRequest instance) =>
    <String, dynamic>{
      'clinicIds': ?instance.clinicIds,
      'mode': instance.mode,
      'reason': instance.reason,
    };

const _$FlagModeEnumMap = {
  FlagMode.off: 'off',
  FlagMode.valueOn: 'on',
  FlagMode.selected: 'selected',
};
