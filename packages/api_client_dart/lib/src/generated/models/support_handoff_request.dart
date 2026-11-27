// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'support_handoff_request.g.dart';

@JsonSerializable()
class SupportHandoffRequest {
  const SupportHandoffRequest({required this.token});

  factory SupportHandoffRequest.fromJson(Map<String, Object?> json) =>
      _$SupportHandoffRequestFromJson(json);

  final String token;

  Map<String, Object?> toJson() => _$SupportHandoffRequestToJson(this);
}
