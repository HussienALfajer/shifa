// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mfa_status.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MfaStatus _$MfaStatusFromJson(Map<String, dynamic> json) => MfaStatus(
  enrolled: json['enrolled'] as bool,
  enrolledAt: json['enrolledAt'] == null
      ? null
      : DateTime.parse(json['enrolledAt'] as String),
  recoveryCodesLeft: (json['recoveryCodesLeft'] as num?)?.toInt(),
);

Map<String, dynamic> _$MfaStatusToJson(MfaStatus instance) => <String, dynamic>{
  'enrolled': instance.enrolled,
  'enrolledAt': instance.enrolledAt?.toIso8601String(),
  'recoveryCodesLeft': instance.recoveryCodesLeft,
};
