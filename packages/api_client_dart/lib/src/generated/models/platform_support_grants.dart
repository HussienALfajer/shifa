// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'support_grant_view.dart';

part 'platform_support_grants.g.dart';

@JsonSerializable()
class PlatformSupportGrants {
  const PlatformSupportGrants({
    required this.grants,
    required this.mine,
    required this.now,
  });

  factory PlatformSupportGrants.fromJson(Map<String, Object?> json) =>
      _$PlatformSupportGrantsFromJson(json);

  final List<SupportGrantView> grants;
  @JsonKey(includeIfNull: true)
  final SupportGrantView? mine;
  final DateTime now;

  Map<String, Object?> toJson() => _$PlatformSupportGrantsToJson(this);
}
