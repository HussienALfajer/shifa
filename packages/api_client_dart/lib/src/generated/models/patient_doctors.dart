// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'treating_doctor.dart';

part 'patient_doctors.g.dart';

@JsonSerializable()
class PatientDoctors {
  const PatientDoctors({required this.doctors});

  factory PatientDoctors.fromJson(Map<String, Object?> json) =>
      _$PatientDoctorsFromJson(json);

  final List<TreatingDoctor> doctors;

  Map<String, Object?> toJson() => _$PatientDoctorsToJson(this);
}
