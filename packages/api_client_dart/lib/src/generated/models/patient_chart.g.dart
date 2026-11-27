// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_chart.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientChart _$PatientChartFromJson(Map<String, dynamic> json) => PatientChart(
  archivedAt: json['archivedAt'] == null
      ? null
      : DateTime.parse(json['archivedAt'] as String),
  archivedByName: json['archivedByName'] as String?,
  birthDate: json['birthDate'] as String,
  birthDateEstimated: json['birthDateEstimated'] as bool,
  contactPhone: json['contactPhone'] as String,
  createdAt: DateTime.parse(json['createdAt'] as String),
  createdByName: json['createdByName'] as String?,
  displayName: json['displayName'] as String,
  familyName: json['familyName'] as String?,
  fatherName: json['fatherName'] as String?,
  fileNumber: (json['fileNumber'] as num).toInt(),
  givenName: json['givenName'] as String,
  id: json['id'] as String,
  mergedInto: json['mergedInto'] == null
      ? null
      : PatientMergedInto.fromJson(json['mergedInto'] as Map<String, dynamic>),
  motherName: json['motherName'] as String?,
  previousFileNumber: json['previousFileNumber'] as String?,
  registeredBranch: json['registeredBranch'] == null
      ? null
      : PatientBranch.fromJson(
          json['registeredBranch'] as Map<String, dynamic>,
        ),
  secondPhone: json['secondPhone'] as String?,
  sex: $enumDecode(_$SexEnumMap, json['sex']),
  state: $enumDecode(_$PatientStateEnumMap, json['state']),
  updatedAt: DateTime.parse(json['updatedAt'] as String),
  updatedByName: json['updatedByName'] as String?,
);

Map<String, dynamic> _$PatientChartToJson(PatientChart instance) =>
    <String, dynamic>{
      'archivedAt': instance.archivedAt?.toIso8601String(),
      'archivedByName': instance.archivedByName,
      'birthDate': instance.birthDate,
      'birthDateEstimated': instance.birthDateEstimated,
      'contactPhone': instance.contactPhone,
      'createdAt': instance.createdAt.toIso8601String(),
      'createdByName': instance.createdByName,
      'displayName': instance.displayName,
      'familyName': instance.familyName,
      'fatherName': instance.fatherName,
      'fileNumber': instance.fileNumber,
      'givenName': instance.givenName,
      'id': instance.id,
      'mergedInto': instance.mergedInto,
      'motherName': instance.motherName,
      'previousFileNumber': instance.previousFileNumber,
      'registeredBranch': instance.registeredBranch,
      'secondPhone': instance.secondPhone,
      'sex': instance.sex,
      'state': instance.state,
      'updatedAt': instance.updatedAt.toIso8601String(),
      'updatedByName': instance.updatedByName,
    };

const _$SexEnumMap = {Sex.male: 'male', Sex.female: 'female'};

const _$PatientStateEnumMap = {
  PatientState.active: 'active',
  PatientState.archived: 'archived',
  PatientState.merged: 'merged',
};
