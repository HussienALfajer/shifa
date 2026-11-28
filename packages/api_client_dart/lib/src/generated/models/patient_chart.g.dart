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
  family: (json['family'] as List<dynamic>)
      .map((e) => FamilyMember.fromJson(e as Map<String, dynamic>))
      .toList(),
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
  relation: $enumDecodeNullable(_$PatientRelationEnumMap, json['relation']),
  secondPhone: json['secondPhone'] as String?,
  sex: $enumDecode(_$SexEnumMap, json['sex']),
  state: $enumDecode(_$PatientStateEnumMap, json['state']),
  treatingDoctors: (json['treatingDoctors'] as List<dynamic>)
      .map((e) => TreatingDoctor.fromJson(e as Map<String, dynamic>))
      .toList(),
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
      'family': instance.family,
      'familyName': instance.familyName,
      'fatherName': instance.fatherName,
      'fileNumber': instance.fileNumber,
      'givenName': instance.givenName,
      'id': instance.id,
      'mergedInto': instance.mergedInto,
      'motherName': instance.motherName,
      'previousFileNumber': instance.previousFileNumber,
      'registeredBranch': instance.registeredBranch,
      'relation': instance.relation,
      'secondPhone': instance.secondPhone,
      'sex': instance.sex,
      'state': instance.state,
      'treatingDoctors': instance.treatingDoctors,
      'updatedAt': instance.updatedAt.toIso8601String(),
      'updatedByName': instance.updatedByName,
    };

const _$PatientRelationEnumMap = {
  PatientRelation.holder: 'holder',
  PatientRelation.son: 'son',
  PatientRelation.daughter: 'daughter',
  PatientRelation.husband: 'husband',
  PatientRelation.wife: 'wife',
  PatientRelation.father: 'father',
  PatientRelation.mother: 'mother',
  PatientRelation.brother: 'brother',
  PatientRelation.sister: 'sister',
  PatientRelation.other: 'other',
};

const _$SexEnumMap = {Sex.male: 'male', Sex.female: 'female'};

const _$PatientStateEnumMap = {
  PatientState.active: 'active',
  PatientState.archived: 'archived',
  PatientState.merged: 'merged',
};
