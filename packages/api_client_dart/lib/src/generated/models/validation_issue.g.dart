// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'validation_issue.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ValidationIssue _$ValidationIssueFromJson(Map<String, dynamic> json) =>
    ValidationIssue(
      code: $enumDecode(_$ValidationIssueCodeEnumMap, json['code']),
      path: json['path'] as String,
    );

Map<String, dynamic> _$ValidationIssueToJson(ValidationIssue instance) =>
    <String, dynamic>{'code': instance.code, 'path': instance.path};

const _$ValidationIssueCodeEnumMap = {
  ValidationIssueCode.invalidType: 'invalid_type',
  ValidationIssueCode.tooBig: 'too_big',
  ValidationIssueCode.tooSmall: 'too_small',
  ValidationIssueCode.invalidFormat: 'invalid_format',
  ValidationIssueCode.notMultipleOf: 'not_multiple_of',
  ValidationIssueCode.unrecognizedKeys: 'unrecognized_keys',
  ValidationIssueCode.invalidUnion: 'invalid_union',
  ValidationIssueCode.invalidKey: 'invalid_key',
  ValidationIssueCode.invalidElement: 'invalid_element',
  ValidationIssueCode.invalidValue: 'invalid_value',
  ValidationIssueCode.custom: 'custom',
};
