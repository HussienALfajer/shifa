// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_field_validation.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFieldValidation _$PatientFieldValidationFromJson(
  Map<String, dynamic> json,
) => PatientFieldValidation(
  max: json['max'] as num?,
  maxLength: (json['maxLength'] as num?)?.toInt(),
  min: json['min'] as num?,
  minLength: (json['minLength'] as num?)?.toInt(),
  pattern: json['pattern'] == null
      ? null
      : PatientFieldPattern.fromJson(json['pattern'] as Map<String, dynamic>),
);

Map<String, dynamic> _$PatientFieldValidationToJson(
  PatientFieldValidation instance,
) => <String, dynamic>{
  'max': instance.max,
  'maxLength': instance.maxLength,
  'min': instance.min,
  'minLength': instance.minLength,
  'pattern': instance.pattern,
};
