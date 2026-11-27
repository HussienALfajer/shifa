// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'area.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Area _$AreaFromJson(Map<String, dynamic> json) => Area(
  archivedAt: json['archivedAt'] == null
      ? null
      : DateTime.parse(json['archivedAt'] as String),
  branchCount: (json['branchCount'] as num).toInt(),
  cityId: json['cityId'] as String,
  clinicCount: (json['clinicCount'] as num).toInt(),
  doctorCount: (json['doctorCount'] as num).toInt(),
  id: json['id'] as String,
  name: json['name'] as String,
);

Map<String, dynamic> _$AreaToJson(Area instance) => <String, dynamic>{
  'archivedAt': instance.archivedAt?.toIso8601String(),
  'branchCount': instance.branchCount,
  'cityId': instance.cityId,
  'clinicCount': instance.clinicCount,
  'doctorCount': instance.doctorCount,
  'id': instance.id,
  'name': instance.name,
};
