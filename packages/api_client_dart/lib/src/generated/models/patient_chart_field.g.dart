// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_chart_field.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientChartField _$PatientChartFieldFromJson(Map<String, dynamic> json) =>
    PatientChartField(
      key: json['key'] as PatientFieldKey,
      label: json['label'] as String,
      options: (json['options'] as List<dynamic>)
          .map(
            (e) => PatientChartFieldOption.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
      order: (json['order'] as num).toInt(),
      section: json['section'] as String,
      sensitive: json['sensitive'] as bool,
      type: $enumDecode(_$PatientFieldTypeEnumMap, json['type']),
      value: json['value'],
    );

Map<String, dynamic> _$PatientChartFieldToJson(PatientChartField instance) =>
    <String, dynamic>{
      'key': instance.key,
      'label': instance.label,
      'options': instance.options,
      'order': instance.order,
      'section': instance.section,
      'sensitive': instance.sensitive,
      'type': instance.type,
      'value': instance.value,
    };

const _$PatientFieldTypeEnumMap = {
  PatientFieldType.text: 'text',
  PatientFieldType.longText: 'long_text',
  PatientFieldType.number: 'number',
  PatientFieldType.date: 'date',
  PatientFieldType.singleChoice: 'single_choice',
  PatientFieldType.multiChoice: 'multi_choice',
  PatientFieldType.yesNo: 'yes_no',
  PatientFieldType.phone: 'phone',
};
