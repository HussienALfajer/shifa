// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'patient_search_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PatientSearchResult _$PatientSearchResultFromJson(Map<String, dynamic> json) =>
    PatientSearchResult(
      archivedAt: json['archivedAt'] == null
          ? null
          : DateTime.parse(json['archivedAt'] as String),
      birthDate: json['birthDate'] as String,
      birthDateEstimated: json['birthDateEstimated'] as bool,
      contactPhone: json['contactPhone'] as String,
      displayName: json['displayName'] as String,
      familyName: json['familyName'] as String?,
      fatherName: json['fatherName'] as String?,
      fileNumber: (json['fileNumber'] as num).toInt(),
      givenName: json['givenName'] as String,
      id: json['id'] as String,
      matchedBy: $enumDecode(_$PatientMatchKindEnumMap, json['matchedBy']),
      matchedParts: (json['matchedParts'] as List<dynamic>)
          .map((e) => (e as num).toInt())
          .toList(),
      mergedFileNumber: (json['mergedFileNumber'] as num?)?.toInt(),
      sex: $enumDecode(_$SexEnumMap, json['sex']),
      state: $enumDecode(_$PatientStateEnumMap, json['state']),
    );

Map<String, dynamic> _$PatientSearchResultToJson(
  PatientSearchResult instance,
) => <String, dynamic>{
  'archivedAt': instance.archivedAt?.toIso8601String(),
  'birthDate': instance.birthDate,
  'birthDateEstimated': instance.birthDateEstimated,
  'contactPhone': instance.contactPhone,
  'displayName': instance.displayName,
  'familyName': instance.familyName,
  'fatherName': instance.fatherName,
  'fileNumber': instance.fileNumber,
  'givenName': instance.givenName,
  'id': instance.id,
  'matchedBy': instance.matchedBy,
  'matchedParts': instance.matchedParts,
  'mergedFileNumber': instance.mergedFileNumber,
  'sex': instance.sex,
  'state': instance.state,
};

const _$PatientMatchKindEnumMap = {
  PatientMatchKind.name: 'name',
  PatientMatchKind.nameVariant: 'name_variant',
  PatientMatchKind.nameOrder: 'name_order',
  PatientMatchKind.phone: 'phone',
  PatientMatchKind.phoneTail: 'phone_tail',
  PatientMatchKind.fileNumber: 'file_number',
  PatientMatchKind.previousFileNumber: 'previous_file_number',
  PatientMatchKind.customField: 'custom_field',
};

const _$SexEnumMap = {Sex.male: 'male', Sex.female: 'female'};

const _$PatientStateEnumMap = {
  PatientState.active: 'active',
  PatientState.archived: 'archived',
  PatientState.merged: 'merged',
};
