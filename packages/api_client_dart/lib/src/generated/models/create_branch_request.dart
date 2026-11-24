// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'create_branch_request.g.dart';

@JsonSerializable()
class CreateBranchRequest {
  const CreateBranchRequest({required this.name, this.address, this.phone});

  factory CreateBranchRequest.fromJson(Map<String, Object?> json) =>
      _$CreateBranchRequestFromJson(json);

  @JsonKey(includeIfNull: false)
  final String? address;
  final String name;
  @JsonKey(includeIfNull: false)
  final String? phone;

  Map<String, Object?> toJson() => _$CreateBranchRequestToJson(this);
}
