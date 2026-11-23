// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicList _$ClinicListFromJson(Map<String, dynamic> json) => ClinicList(
  clinics: (json['clinics'] as List<dynamic>)
      .map((e) => ClinicSummary.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$ClinicListToJson(ClinicList instance) =>
    <String, dynamic>{'clinics': instance.clinics};
