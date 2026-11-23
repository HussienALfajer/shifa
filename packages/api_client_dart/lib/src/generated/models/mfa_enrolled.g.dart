// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mfa_enrolled.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MfaEnrolled _$MfaEnrolledFromJson(Map<String, dynamic> json) => MfaEnrolled(
  recoveryCodes: (json['recoveryCodes'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  session: SessionView.fromJson(json['session'] as Map<String, dynamic>),
);

Map<String, dynamic> _$MfaEnrolledToJson(MfaEnrolled instance) =>
    <String, dynamic>{
      'recoveryCodes': instance.recoveryCodes,
      'session': instance.session,
    };
