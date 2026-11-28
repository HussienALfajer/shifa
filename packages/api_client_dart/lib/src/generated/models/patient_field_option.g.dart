// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_field_option.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFieldOption _$PatientFieldOptionFromJson(Map<String, dynamic> json) =>
    PatientFieldOption(
      archived: json['archived'] as bool,
      chartCount: (json['chartCount'] as num).toInt(),
      id: json['id'] as String,
      label: json['label'] as String,
      order: (json['order'] as num).toInt(),
    );

Map<String, dynamic> _$PatientFieldOptionToJson(PatientFieldOption instance) =>
    <String, dynamic>{
      'archived': instance.archived,
      'chartCount': instance.chartCount,
      'id': instance.id,
      'label': instance.label,
      'order': instance.order,
    };
