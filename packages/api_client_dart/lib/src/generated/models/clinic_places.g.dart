// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_places.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicPlaces _$ClinicPlacesFromJson(Map<String, dynamic> json) => ClinicPlaces(
  cities: (json['cities'] as List<dynamic>)
      .map((e) => ClinicCity.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$ClinicPlacesToJson(ClinicPlaces instance) =>
    <String, dynamic>{'cities': instance.cities};
