// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'lock_setting_request.g.dart';

@JsonSerializable()
class LockSettingRequest {
  const LockSettingRequest({required this.value});

  factory LockSettingRequest.fromJson(Map<String, Object?> json) =>
      _$LockSettingRequestFromJson(json);

  final dynamic value;

  Map<String, Object?> toJson() => _$LockSettingRequestToJson(this);
}
