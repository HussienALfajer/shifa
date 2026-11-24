// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mfa_passed.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MfaPassed _$MfaPassedFromJson(Map<String, dynamic> json) => MfaPassed(
  recoveryCodesLeft: (json['recoveryCodesLeft'] as num).toInt(),
  session: SessionView.fromJson(json['session'] as Map<String, dynamic>),
);

Map<String, dynamic> _$MfaPassedToJson(MfaPassed instance) => <String, dynamic>{
  'recoveryCodesLeft': instance.recoveryCodesLeft,
  'session': instance.session,
};
