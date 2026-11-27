// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_city.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicCity _$ClinicCityFromJson(Map<String, dynamic> json) => ClinicCity(
  archived: json['archived'] as bool,
  areas: (json['areas'] as List<dynamic>)
      .map((e) => ClinicArea.fromJson(e as Map<String, dynamic>))
      .toList(),
  id: json['id'] as String,
  name: json['name'] as String,
);

Map<String, dynamic> _$ClinicCityToJson(ClinicCity instance) =>
    <String, dynamic>{
      'archived': instance.archived,
      'areas': instance.areas,
      'id': instance.id,
      'name': instance.name,
    };
