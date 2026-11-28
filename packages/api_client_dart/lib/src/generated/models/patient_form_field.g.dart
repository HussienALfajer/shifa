// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_form_field.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFormField _$PatientFormFieldFromJson(Map<String, dynamic> json) =>
    PatientFormField(
      defaultValue: json['default'],
      editable: json['editable'] as bool,
      key: json['key'] as PatientFieldKey,
      label: json['label'] as String,
      options: (json['options'] as List<dynamic>)
          .map(
            (e) => PatientFormFieldOption.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
      order: (json['order'] as num).toInt(),
      requiredValue: json['required'] as bool,
      section: json['section'] as String,
      sensitive: json['sensitive'] as bool,
      type: $enumDecode(_$PatientFieldTypeEnumMap, json['type']),
      validation: PatientFieldValidation.fromJson(
        json['validation'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$PatientFormFieldToJson(PatientFormField instance) =>
    <String, dynamic>{
      'default': instance.defaultValue,
      'editable': instance.editable,
      'key': instance.key,
      'label': instance.label,
      'options': instance.options,
      'order': instance.order,
      'required': instance.requiredValue,
      'section': instance.section,
      'sensitive': instance.sensitive,
      'type': instance.type,
      'validation': instance.validation,
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
