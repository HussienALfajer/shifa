// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'clinic_status.dart';
import 'clinic_type.dart';

part 'update_clinic_request.g.dart';

@JsonSerializable()
class UpdateClinicRequest {
  const UpdateClinicRequest({this.status, this.subscriptionEnd, this.type});

  factory UpdateClinicRequest.fromJson(Map<String, Object?> json) =>
      _$UpdateClinicRequestFromJson(json);

  @JsonKey(includeIfNull: false)
  final ClinicStatus? status;
  @JsonKey(includeIfNull: false)
  final String? subscriptionEnd;
  @JsonKey(includeIfNull: false)
  final ClinicType? type;

  Map<String, Object?> toJson() => _$UpdateClinicRequestToJson(this);
}
