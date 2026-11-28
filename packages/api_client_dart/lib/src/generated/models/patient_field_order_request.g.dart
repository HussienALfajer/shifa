// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_field_order_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientFieldOrderRequest _$PatientFieldOrderRequestFromJson(
  Map<String, dynamic> json,
) => PatientFieldOrderRequest(
  expectedUpdatedAt: json['expectedUpdatedAt'] == null
      ? null
      : DateTime.parse(json['expectedUpdatedAt'] as String),
  sections: (json['sections'] as List<dynamic>)
      .map((e) => PatientFieldOrderSection.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$PatientFieldOrderRequestToJson(
  PatientFieldOrderRequest instance,
) => <String, dynamic>{
  'expectedUpdatedAt': instance.expectedUpdatedAt?.toIso8601String(),
  'sections': instance.sections,
};
