// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'setup_link_token.dart';

part 'set_password_request.g.dart';

@JsonSerializable()
class SetPasswordRequest {
  const SetPasswordRequest({required this.password, required this.token});

  factory SetPasswordRequest.fromJson(Map<String, Object?> json) =>
      _$SetPasswordRequestFromJson(json);

  final String password;
  final SetupLinkToken token;

  Map<String, Object?> toJson() => _$SetPasswordRequestToJson(this);
}
