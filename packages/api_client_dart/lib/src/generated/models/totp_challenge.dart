// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'totp_challenge_method.dart';

part 'totp_challenge.g.dart';

@JsonSerializable()
class TotpChallenge {
  const TotpChallenge({required this.code, required this.method});

  factory TotpChallenge.fromJson(Map<String, Object?> json) =>
      _$TotpChallengeFromJson(json);

  final String code;
  final TotpChallengeMethod method;

  Map<String, Object?> toJson() => _$TotpChallengeToJson(this);
}
