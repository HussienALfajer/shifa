// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'family_member.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FamilyMember _$FamilyMemberFromJson(Map<String, dynamic> json) => FamilyMember(
  birthDate: json['birthDate'] as String,
  birthDateEstimated: json['birthDateEstimated'] as bool,
  contactPhone: json['contactPhone'] as String,
  displayName: json['displayName'] as String,
  fileNumber: (json['fileNumber'] as num).toInt(),
  id: json['id'] as String,
  relation: $enumDecodeNullable(_$PatientRelationEnumMap, json['relation']),
  sex: $enumDecode(_$SexEnumMap, json['sex']),
  state: $enumDecode(_$PatientStateEnumMap, json['state']),
);

Map<String, dynamic> _$FamilyMemberToJson(FamilyMember instance) =>
    <String, dynamic>{
      'birthDate': instance.birthDate,
      'birthDateEstimated': instance.birthDateEstimated,
      'contactPhone': instance.contactPhone,
      'displayName': instance.displayName,
      'fileNumber': instance.fileNumber,
      'id': instance.id,
      'relation': instance.relation,
      'sex': instance.sex,
      'state': instance.state,
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
