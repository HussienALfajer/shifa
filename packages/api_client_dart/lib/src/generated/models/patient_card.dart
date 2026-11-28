// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'patient_state.dart';
import 'sex.dart';

part 'patient_card.g.dart';

@JsonSerializable()
class PatientCard {
  const PatientCard({
    required this.birthDate,
    required this.birthDateEstimated,
    required this.contactPhone,
    required this.displayName,
    required this.fileNumber,
    required this.id,
    required this.sex,
    required this.state,
  });

  factory PatientCard.fromJson(Map<String, Object?> json) =>
      _$PatientCardFromJson(json);

  final String birthDate;
  final bool birthDateEstimated;
  final String contactPhone;
  final String displayName;
  final int fileNumber;
  final String id;
  final Sex sex;
  final PatientState state;

  Map<String, Object?> toJson() => _$PatientCardToJson(this);
}
