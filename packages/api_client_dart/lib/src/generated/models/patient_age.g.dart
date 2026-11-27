// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_age.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientAge _$PatientAgeFromJson(Map<String, dynamic> json) => PatientAge(
  unit: $enumDecode(_$AgeUnitEnumMap, json['unit']),
  value: (json['value'] as num).toInt(),
);

Map<String, dynamic> _$PatientAgeToJson(PatientAge instance) =>
    <String, dynamic>{'unit': instance.unit, 'value': instance.value};

const _$AgeUnitEnumMap = {AgeUnit.years: 'years', AgeUnit.months: 'months'};
