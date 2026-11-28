// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_form_fields.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFormFields _$PatientFormFieldsFromJson(Map<String, dynamic> json) =>
    PatientFormFields(
      fields: (json['fields'] as List<dynamic>)
          .map((e) => PatientFormField.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$PatientFormFieldsToJson(PatientFormFields instance) =>
    <String, dynamic>{'fields': instance.fields};
