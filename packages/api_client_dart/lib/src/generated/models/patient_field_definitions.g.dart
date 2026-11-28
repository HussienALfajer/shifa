// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_field_definitions.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFieldDefinitions _$PatientFieldDefinitionsFromJson(
  Map<String, dynamic> json,
) => PatientFieldDefinitions(
  fields: (json['fields'] as List<dynamic>)
      .map((e) => PatientFieldDefinition.fromJson(e as Map<String, dynamic>))
      .toList(),
  limits: PatientFieldLimits.fromJson(json['limits'] as Map<String, dynamic>),
  listUpdatedAt: json['listUpdatedAt'] == null
      ? null
      : DateTime.parse(json['listUpdatedAt'] as String),
);

Map<String, dynamic> _$PatientFieldDefinitionsToJson(
  PatientFieldDefinitions instance,
) => <String, dynamic>{
  'fields': instance.fields,
  'limits': instance.limits,
  'listUpdatedAt': instance.listUpdatedAt?.toIso8601String(),
};
