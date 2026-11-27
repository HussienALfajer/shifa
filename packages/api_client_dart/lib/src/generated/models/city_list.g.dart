// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'city_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CityList _$CityListFromJson(Map<String, dynamic> json) => CityList(
  cities: (json['cities'] as List<dynamic>)
      .map((e) => City.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$CityListToJson(CityList instance) => <String, dynamic>{
  'cities': instance.cities,
};
