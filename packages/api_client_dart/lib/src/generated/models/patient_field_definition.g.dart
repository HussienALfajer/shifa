// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_field_definition.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFieldDefinition _$PatientFieldDefinitionFromJson(
  Map<String, dynamic> json,
) => PatientFieldDefinition(
  archivedAt: json['archivedAt'] == null
      ? null
      : DateTime.parse(json['archivedAt'] as String),
  chartCount: (json['chartCount'] as num).toInt(),
  createdAt: DateTime.parse(json['createdAt'] as String),
  defaultValue: json['default'],
  editRoles: (json['editRoles'] as List<dynamic>)
      .map((e) => $enumDecode(_$SessionRoleEnumMap, e))
      .toList(),
  key: json['key'] as PatientFieldKey,
  label: json['label'] as String,
  labelEn: json['labelEn'] as String?,
  options: (json['options'] as List<dynamic>)
      .map((e) => PatientFieldOption.fromJson(e as Map<String, dynamic>))
      .toList(),
  order: (json['order'] as num).toInt(),
  print: json['print'] as bool,
  purgeAt: json['purgeAt'] == null
      ? null
      : DateTime.parse(json['purgeAt'] as String),
  requiredValue: json['required'] as bool,
  searchable: json['searchable'] as bool,
  section: json['section'] as String,
  sensitive: json['sensitive'] as bool,
  state: $enumDecode(_$PatientFieldStateEnumMap, json['state']),
  type: $enumDecode(_$PatientFieldTypeEnumMap, json['type']),
  updatedAt: DateTime.parse(json['updatedAt'] as String),
  validation: PatientFieldValidation.fromJson(
    json['validation'] as Map<String, dynamic>,
  ),
  viewRoles: (json['viewRoles'] as List<dynamic>)
      .map((e) => $enumDecode(_$SessionRoleEnumMap, e))
      .toList(),
);

Map<String, dynamic> _$PatientFieldDefinitionToJson(
  PatientFieldDefinition instance,
) => <String, dynamic>{
  'archivedAt': instance.archivedAt?.toIso8601String(),
  'chartCount': instance.chartCount,
  'createdAt': instance.createdAt.toIso8601String(),
  'default': instance.defaultValue,
  'editRoles': instance.editRoles,
  'key': instance.key,
  'label': instance.label,
  'labelEn': instance.labelEn,
  'options': instance.options,
  'order': instance.order,
  'print': instance.print,
  'purgeAt': instance.purgeAt?.toIso8601String(),
  'required': instance.requiredValue,
  'searchable': instance.searchable,
  'section': instance.section,
  'sensitive': instance.sensitive,
  'state': instance.state,
  'type': instance.type,
  'updatedAt': instance.updatedAt.toIso8601String(),
  'validation': instance.validation,
  'viewRoles': instance.viewRoles,
};

const _$SessionRoleEnumMap = {
  SessionRole.owner: 'owner',
  SessionRole.doctor: 'doctor',
  SessionRole.receptionist: 'receptionist',
  SessionRole.assistant: 'assistant',
  SessionRole.accountant: 'accountant',
};

const _$PatientFieldStateEnumMap = {
  PatientFieldState.active: 'active',
  PatientFieldState.archived: 'archived',
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
