// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'flag_mode.dart';

part 'set_flag_request.g.dart';

@JsonSerializable()
class SetFlagRequest {
  const SetFlagRequest({
    required this.mode,
    required this.reason,
    this.clinicIds,
  });

  factory SetFlagRequest.fromJson(Map<String, Object?> json) =>
      _$SetFlagRequestFromJson(json);

  @JsonKey(includeIfNull: false)
  final List<String>? clinicIds;
  final FlagMode mode;
  final String reason;

  Map<String, Object?> toJson() => _$SetFlagRequestToJson(this);
}
