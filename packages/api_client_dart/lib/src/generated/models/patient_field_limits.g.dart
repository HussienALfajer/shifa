// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_field_limits.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFieldLimits _$PatientFieldLimitsFromJson(Map<String, dynamic> json) =>
    PatientFieldLimits(
      max: (json['max'] as num).toInt(),
      searchableMax: (json['searchableMax'] as num).toInt(),
      searchableUsed: (json['searchableUsed'] as num).toInt(),
      used: (json['used'] as num).toInt(),
    );

Map<String, dynamic> _$PatientFieldLimitsToJson(PatientFieldLimits instance) =>
    <String, dynamic>{
      'max': instance.max,
      'searchableMax': instance.searchableMax,
      'searchableUsed': instance.searchableUsed,
      'used': instance.used,
    };
