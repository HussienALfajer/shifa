// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_field_pattern.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFieldPattern _$PatientFieldPatternFromJson(Map<String, dynamic> json) =>
    PatientFieldPattern(
      expression: json['expression'] as String?,
      preset: $enumDecode(_$PatientFieldPatternPresetEnumMap, json['preset']),
    );

Map<String, dynamic> _$PatientFieldPatternToJson(
  PatientFieldPattern instance,
) => <String, dynamic>{
  'expression': instance.expression,
  'preset': instance.preset,
};

const _$PatientFieldPatternPresetEnumMap = {
  PatientFieldPatternPreset.any: 'any',
  PatientFieldPatternPreset.digits: 'digits',
  PatientFieldPatternPreset.letters: 'letters',
  PatientFieldPatternPreset.custom: 'custom',
};
