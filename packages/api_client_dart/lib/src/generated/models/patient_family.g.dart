// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_family.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFamily _$PatientFamilyFromJson(Map<String, dynamic> json) =>
    PatientFamily(
      holder: json['holder'] == null
          ? null
          : FamilyMember.fromJson(json['holder'] as Map<String, dynamic>),
      members: (json['members'] as List<dynamic>)
          .map((e) => FamilyMember.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$PatientFamilyToJson(PatientFamily instance) =>
    <String, dynamic>{'holder': instance.holder, 'members': instance.members};
