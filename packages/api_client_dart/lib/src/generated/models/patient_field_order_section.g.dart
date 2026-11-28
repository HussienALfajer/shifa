// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_field_order_section.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFieldOrderSection _$PatientFieldOrderSectionFromJson(
  Map<String, dynamic> json,
) => PatientFieldOrderSection(
  keys: (json['keys'] as List<dynamic>)
      .map((e) => e as PatientFieldKey)
      .toList(),
  title: json['title'] as String,
);

Map<String, dynamic> _$PatientFieldOrderSectionToJson(
  PatientFieldOrderSection instance,
) => <String, dynamic>{'keys': instance.keys, 'title': instance.title};
