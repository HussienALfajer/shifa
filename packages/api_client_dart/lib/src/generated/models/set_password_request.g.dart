// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'set_password_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SetPasswordRequest _$SetPasswordRequestFromJson(Map<String, dynamic> json) =>
    SetPasswordRequest(
      password: json['password'] as String,
      token: json['token'] as SetupLinkToken,
    );

Map<String, dynamic> _$SetPasswordRequestToJson(SetPasswordRequest instance) =>
    <String, dynamic>{'password': instance.password, 'token': instance.token};
