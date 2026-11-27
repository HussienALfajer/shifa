// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'branch.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Branch _$BranchFromJson(Map<String, dynamic> json) => Branch(
  address: json['address'] as String?,
  archivedAt: json['archivedAt'] == null
      ? null
      : DateTime.parse(json['archivedAt'] as String),
  area: json['area'] == null
      ? null
      : BranchPlace.fromJson(json['area'] as Map<String, dynamic>),
  city: json['city'] == null
      ? null
      : BranchPlace.fromJson(json['city'] as Map<String, dynamic>),
  id: json['id'] as String,
  memberCount: (json['memberCount'] as num).toInt(),
  name: json['name'] as String,
  phone: json['phone'] as String?,
);

Map<String, dynamic> _$BranchToJson(Branch instance) => <String, dynamic>{
  'address': instance.address,
  'archivedAt': instance.archivedAt?.toIso8601String(),
  'area': instance.area,
  'city': instance.city,
  'id': instance.id,
  'memberCount': instance.memberCount,
  'name': instance.name,
  'phone': instance.phone,
};
