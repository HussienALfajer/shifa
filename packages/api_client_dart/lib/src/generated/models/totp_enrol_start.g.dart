// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'totp_enrol_start.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TotpEnrolStart _$TotpEnrolStartFromJson(Map<String, dynamic> json) =>
    TotpEnrolStart(
      manualKey: json['manualKey'] as String,
      otpauthUri: json['otpauthUri'] as String,
    );

Map<String, dynamic> _$TotpEnrolStartToJson(TotpEnrolStart instance) =>
    <String, dynamic>{
      'manualKey': instance.manualKey,
      'otpauthUri': instance.otpauthUri,
    };
