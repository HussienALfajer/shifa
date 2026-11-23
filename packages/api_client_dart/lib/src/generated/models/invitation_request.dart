// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'setup_link_token.dart';

part 'invitation_request.g.dart';

@JsonSerializable()
class InvitationRequest {
  const InvitationRequest({required this.token});

  factory InvitationRequest.fromJson(Map<String, Object?> json) =>
      _$InvitationRequestFromJson(json);

  final SetupLinkToken token;

  Map<String, Object?> toJson() => _$InvitationRequestToJson(this);
}
