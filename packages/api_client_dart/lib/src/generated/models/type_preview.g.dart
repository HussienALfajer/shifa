// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'type_preview.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TypePreview _$TypePreviewFromJson(Map<String, dynamic> json) => TypePreview(
  limits: (json['limits'] as List<dynamic>)
      .map((e) => TypePreviewLimit.fromJson(e as Map<String, dynamic>))
      .toList(),
  type: $enumDecode(_$ClinicTypeEnumMap, json['type']),
);

Map<String, dynamic> _$TypePreviewToJson(TypePreview instance) =>
    <String, dynamic>{'limits': instance.limits, 'type': instance.type};

const _$ClinicTypeEnumMap = {
  ClinicType.solo: 'solo',
  ClinicType.multiDoctor: 'multi_doctor',
  ClinicType.multiBranch: 'multi_branch',
};
