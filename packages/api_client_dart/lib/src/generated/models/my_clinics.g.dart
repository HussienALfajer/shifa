// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_clinics.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MyClinics _$MyClinicsFromJson(Map<String, dynamic> json) => MyClinics(
  clinics: (json['clinics'] as List<dynamic>)
      .map((e) => MyClinic.fromJson(e as Map<String, dynamic>))
      .toList(),
  invitations: (json['invitations'] as List<dynamic>)
      .map((e) => MyInvitation.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$MyClinicsToJson(MyClinics instance) => <String, dynamic>{
  'clinics': instance.clinics,
  'invitations': instance.invitations,
};
