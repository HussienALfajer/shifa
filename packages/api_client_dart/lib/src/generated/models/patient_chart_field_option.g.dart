// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_chart_field_option.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientChartFieldOption _$PatientChartFieldOptionFromJson(
  Map<String, dynamic> json,
) => PatientChartFieldOption(
  archived: json['archived'] as bool,
  id: json['id'] as String,
  label: json['label'] as String,
);

Map<String, dynamic> _$PatientChartFieldOptionToJson(
  PatientChartFieldOption instance,
) => <String, dynamic>{
  'archived': instance.archived,
  'id': instance.id,
  'label': instance.label,
};
