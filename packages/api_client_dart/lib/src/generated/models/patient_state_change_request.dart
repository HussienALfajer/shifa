// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'patient_state_change_request.g.dart';

@JsonSerializable()
class PatientStateChangeRequest {
  const PatientStateChangeRequest({required this.expectedUpdatedAt});

  factory PatientStateChangeRequest.fromJson(Map<String, Object?> json) =>
      _$PatientStateChangeRequestFromJson(json);

  final DateTime expectedUpdatedAt;

  Map<String, Object?> toJson() => _$PatientStateChangeRequestToJson(this);
}
