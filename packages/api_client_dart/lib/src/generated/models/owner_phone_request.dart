// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'owner_phone_request.g.dart';

@JsonSerializable()
class OwnerPhoneRequest {
  const OwnerPhoneRequest({required this.phone});

  factory OwnerPhoneRequest.fromJson(Map<String, Object?> json) =>
      _$OwnerPhoneRequestFromJson(json);

  final String phone;

  Map<String, Object?> toJson() => _$OwnerPhoneRequestToJson(this);
}
