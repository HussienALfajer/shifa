// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_patient_field_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdatePatientFieldRequest _$UpdatePatientFieldRequestFromJson(
  Map<String, dynamic> json,
) => UpdatePatientFieldRequest(
  expectedUpdatedAt: DateTime.parse(json['expectedUpdatedAt'] as String),
  defaultValue: json['default'],
  editRoles: (json['editRoles'] as List<dynamic>?)
      ?.map((e) => $enumDecode(_$SessionRoleEnumMap, e))
      .toList(),
  label: json['label'] as String?,
  labelEn: json['labelEn'] as String?,
  options: (json['options'] as List<dynamic>?)
      ?.map((e) => PatientFieldOptionInput.fromJson(e as Map<String, dynamic>))
      .toList(),
  print: json['print'] as bool?,
  requiredValue: json['required'] as bool?,
  searchable: json['searchable'] as bool?,
  section: json['section'] as String?,
  sensitive: json['sensitive'] as bool?,
  type: $enumDecodeNullable(_$PatientFieldTypeEnumMap, json['type']),
  validation: json['validation'] == null
      ? null
      : PatientFieldValidationInput.fromJson(
          json['validation'] as Map<String, dynamic>,
        ),
  viewRoles: (json['viewRoles'] as List<dynamic>?)
      ?.map((e) => $enumDecode(_$SessionRoleEnumMap, e))
      .toList(),
);

Map<String, dynamic> _$UpdatePatientFieldRequestToJson(
  UpdatePatientFieldRequest instance,
) => <String, dynamic>{
  'default': ?instance.defaultValue,
  'editRoles': ?instance.editRoles,
  'expectedUpdatedAt': instance.expectedUpdatedAt.toIso8601String(),
  'label': ?instance.label,
  'labelEn': ?instance.labelEn,
  'options': ?instance.options,
  'print': ?instance.print,
  'required': ?instance.requiredValue,
  'searchable': ?instance.searchable,
  'section': ?instance.section,
  'sensitive': ?instance.sensitive,
  'type': ?instance.type,
  'validation': ?instance.validation,
  'viewRoles': ?instance.viewRoles,
};

const _$SessionRoleEnumMap = {
  SessionRole.owner: 'owner',
  SessionRole.doctor: 'doctor',
  SessionRole.receptionist: 'receptionist',
  SessionRole.assistant: 'assistant',
  SessionRole.accountant: 'accountant',
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
