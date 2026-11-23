// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'totp_challenge.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TotpChallenge _$TotpChallengeFromJson(Map<String, dynamic> json) =>
    TotpChallenge(
      code: json['code'] as String,
      method: $enumDecode(_$TotpChallengeMethodEnumMap, json['method']),
    );

Map<String, dynamic> _$TotpChallengeToJson(TotpChallenge instance) =>
    <String, dynamic>{'code': instance.code, 'method': instance.method};

const _$TotpChallengeMethodEnumMap = {
  TotpChallengeMethod.totp: 'totp',
  TotpChallengeMethod.recovery: 'recovery',
};
