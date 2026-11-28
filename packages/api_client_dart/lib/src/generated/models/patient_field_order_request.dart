// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_field_order_section.dart';

part 'patient_field_order_request.g.dart';

@JsonSerializable()
class PatientFieldOrderRequest {
  const PatientFieldOrderRequest({
    required this.expectedUpdatedAt,
    required this.sections,
  });

  factory PatientFieldOrderRequest.fromJson(Map<String, Object?> json) =>
      _$PatientFieldOrderRequestFromJson(json);

  @JsonKey(includeIfNull: true)
  final DateTime? expectedUpdatedAt;
  final List<PatientFieldOrderSection> sections;

  Map<String, Object?> toJson() => _$PatientFieldOrderRequestToJson(this);
}
