// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_count.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientCount _$PatientCountFromJson(Map<String, dynamic> json) => PatientCount(
  active: (json['active'] as num).toInt(),
  archived: (json['archived'] as num).toInt(),
);

Map<String, dynamic> _$PatientCountToJson(PatientCount instance) =>
    <String, dynamic>{'active': instance.active, 'archived': instance.archived};
