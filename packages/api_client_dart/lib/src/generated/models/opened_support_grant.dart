// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'support_grant_view.dart';

part 'opened_support_grant.g.dart';

@JsonSerializable()
class OpenedSupportGrant {
  const OpenedSupportGrant({required this.grant, required this.handoffUrl});

  factory OpenedSupportGrant.fromJson(Map<String, Object?> json) =>
      _$OpenedSupportGrantFromJson(json);

  final SupportGrantView grant;
  final String handoffUrl;

  Map<String, Object?> toJson() => _$OpenedSupportGrantToJson(this);
}
