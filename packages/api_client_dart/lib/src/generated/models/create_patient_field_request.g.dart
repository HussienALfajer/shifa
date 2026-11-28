// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_patient_field_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreatePatientFieldRequest _$CreatePatientFieldRequestFromJson(
  Map<String, dynamic> json,
) => CreatePatientFieldRequest(
  label: json['label'] as String,
  section: json['section'] as String,
  type: $enumDecode(_$PatientFieldTypeEnumMap, json['type']),
  viewRoles: (json['viewRoles'] as List<dynamic>)
      .map((e) => $enumDecode(_$SessionRoleEnumMap, e))
      .toList(),
  defaultValue: json['default'],
  editRoles: (json['editRoles'] as List<dynamic>?)
      ?.map((e) => $enumDecode(_$SessionRoleEnumMap, e))
      .toList(),
  labelEn: json['labelEn'] as String?,
  options: (json['options'] as List<dynamic>?)
      ?.map((e) => PatientFieldOptionInput.fromJson(e as Map<String, dynamic>))
      .toList(),
  print: json['print'] as bool?,
  requiredValue: json['required'] as bool?,
  searchable: json['searchable'] as bool?,
  sensitive: json['sensitive'] as bool?,
  validation: json['validation'] == null
      ? null
      : PatientFieldValidationInput.fromJson(
          json['validation'] as Map<String, dynamic>,
        ),
);

Map<String, dynamic> _$CreatePatientFieldRequestToJson(
  CreatePatientFieldRequest instance,
) => <String, dynamic>{
  'default': ?instance.defaultValue,
  'editRoles': ?instance.editRoles,
  'label': instance.label,
  'labelEn': ?instance.labelEn,
  'options': ?instance.options,
  'print': ?instance.print,
  'required': ?instance.requiredValue,
  'searchable': ?instance.searchable,
  'section': instance.section,
  'sensitive': ?instance.sensitive,
  'type': instance.type,
  'validation': ?instance.validation,
  'viewRoles': instance.viewRoles,
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

const _$SessionRoleEnumMap = {
  SessionRole.owner: 'owner',
  SessionRole.doctor: 'doctor',
  SessionRole.receptionist: 'receptionist',
  SessionRole.assistant: 'assistant',
  SessionRole.accountant: 'accountant',
};
