// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'setup_link_token.dart';

part 'setup_link_request.g.dart';

@JsonSerializable()
class SetupLinkRequest {
  const SetupLinkRequest({required this.token});

  factory SetupLinkRequest.fromJson(Map<String, Object?> json) =>
      _$SetupLinkRequestFromJson(json);

  final SetupLinkToken token;

  Map<String, Object?> toJson() => _$SetupLinkRequestToJson(this);
}
