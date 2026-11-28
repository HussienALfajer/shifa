// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_card.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientCard _$PatientCardFromJson(Map<String, dynamic> json) => PatientCard(
  birthDate: json['birthDate'] as String,
  birthDateEstimated: json['birthDateEstimated'] as bool,
  contactPhone: json['contactPhone'] as String,
  displayName: json['displayName'] as String,
  fileNumber: (json['fileNumber'] as num).toInt(),
  id: json['id'] as String,
  sex: $enumDecode(_$SexEnumMap, json['sex']),
  state: $enumDecode(_$PatientStateEnumMap, json['state']),
);

Map<String, dynamic> _$PatientCardToJson(PatientCard instance) =>
    <String, dynamic>{
      'birthDate': instance.birthDate,
      'birthDateEstimated': instance.birthDateEstimated,
      'contactPhone': instance.contactPhone,
      'displayName': instance.displayName,
      'fileNumber': instance.fileNumber,
      'id': instance.id,
      'sex': instance.sex,
      'state': instance.state,
    };

const _$SexEnumMap = {Sex.male: 'male', Sex.female: 'female'};

const _$PatientStateEnumMap = {
  PatientState.active: 'active',
  PatientState.archived: 'archived',
  PatientState.merged: 'merged',
};
