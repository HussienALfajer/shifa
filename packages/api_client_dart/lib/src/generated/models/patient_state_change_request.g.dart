// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_state_change_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientStateChangeRequest _$PatientStateChangeRequestFromJson(
  Map<String, dynamic> json,
) => PatientStateChangeRequest(
  expectedUpdatedAt: DateTime.parse(json['expectedUpdatedAt'] as String),
);

Map<String, dynamic> _$PatientStateChangeRequestToJson(
  PatientStateChangeRequest instance,
) => <String, dynamic>{
  'expectedUpdatedAt': instance.expectedUpdatedAt.toIso8601String(),
};
