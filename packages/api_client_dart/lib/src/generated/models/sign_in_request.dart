// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'sign_in_request.g.dart';

@JsonSerializable()
class SignInRequest {
  const SignInRequest({required this.password, required this.phone});

  factory SignInRequest.fromJson(Map<String, Object?> json) =>
      _$SignInRequestFromJson(json);

  final String password;
  final String phone;

  Map<String, Object?> toJson() => _$SignInRequestToJson(this);
}
