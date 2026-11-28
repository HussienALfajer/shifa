// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'treating_doctor.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TreatingDoctor _$TreatingDoctorFromJson(Map<String, dynamic> json) =>
    TreatingDoctor(
      active: json['active'] as bool,
      memberId: json['memberId'] as String,
      name: json['name'] as String,
    );

Map<String, dynamic> _$TreatingDoctorToJson(TreatingDoctor instance) =>
    <String, dynamic>{
      'active': instance.active,
      'memberId': instance.memberId,
      'name': instance.name,
    };
