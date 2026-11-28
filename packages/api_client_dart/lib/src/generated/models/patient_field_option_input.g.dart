// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_field_option_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFieldOptionInput _$PatientFieldOptionInputFromJson(
  Map<String, dynamic> json,
) => PatientFieldOptionInput(
  label: json['label'] as String,
  archived: json['archived'] as bool?,
  id: json['id'] as String?,
);

Map<String, dynamic> _$PatientFieldOptionInputToJson(
  PatientFieldOptionInput instance,
) => <String, dynamic>{
  'archived': ?instance.archived,
  'id': ?instance.id,
  'label': instance.label,
};
