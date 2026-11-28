// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_doctors.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientDoctors _$PatientDoctorsFromJson(Map<String, dynamic> json) =>
    PatientDoctors(
      doctors: (json['doctors'] as List<dynamic>)
          .map((e) => TreatingDoctor.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$PatientDoctorsToJson(PatientDoctors instance) =>
    <String, dynamic>{'doctors': instance.doctors};
