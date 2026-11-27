// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'city.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

City _$CityFromJson(Map<String, dynamic> json) => City(
  archivedAt: json['archivedAt'] == null
      ? null
      : DateTime.parse(json['archivedAt'] as String),
  areas: (json['areas'] as List<dynamic>)
      .map((e) => Area.fromJson(e as Map<String, dynamic>))
      .toList(),
  branchCount: (json['branchCount'] as num).toInt(),
  clinicCount: (json['clinicCount'] as num).toInt(),
  doctorCount: (json['doctorCount'] as num).toInt(),
  id: json['id'] as String,
  name: json['name'] as String,
);

Map<String, dynamic> _$CityToJson(City instance) => <String, dynamic>{
  'archivedAt': instance.archivedAt?.toIso8601String(),
  'areas': instance.areas,
  'branchCount': instance.branchCount,
  'clinicCount': instance.clinicCount,
  'doctorCount': instance.doctorCount,
  'id': instance.id,
  'name': instance.name,
};
