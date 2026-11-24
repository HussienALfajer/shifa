// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'update_branch_request.g.dart';

@JsonSerializable()
class UpdateBranchRequest {
  const UpdateBranchRequest({this.address, this.name, this.phone});

  factory UpdateBranchRequest.fromJson(Map<String, Object?> json) =>
      _$UpdateBranchRequestFromJson(json);

  @JsonKey(includeIfNull: false)
  final String? address;
  @JsonKey(includeIfNull: false)
  final String? name;
  @JsonKey(includeIfNull: false)
  final String? phone;

  Map<String, Object?> toJson() => _$UpdateBranchRequestToJson(this);
}
