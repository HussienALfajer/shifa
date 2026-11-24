// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invitation_view.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InvitationView _$InvitationViewFromJson(Map<String, dynamic> json) =>
    InvitationView(
      clinicName: json['clinicName'] as String,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      personName: json['personName'] as String,
      phoneMasked: json['phoneMasked'] as String,
      roles: (json['roles'] as List<dynamic>)
          .map((e) => InvitationRole.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$InvitationViewToJson(InvitationView instance) =>
    <String, dynamic>{
      'clinicName': instance.clinicName,
      'expiresAt': instance.expiresAt.toIso8601String(),
      'personName': instance.personName,
      'phoneMasked': instance.phoneMasked,
      'roles': instance.roles,
    };
