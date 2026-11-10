// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum ValidationIssueCode {
  @JsonValue('invalid_type')
  invalidType('invalid_type'),
  @JsonValue('too_big')
  tooBig('too_big'),
  @JsonValue('too_small')
  tooSmall('too_small'),
  @JsonValue('invalid_format')
  invalidFormat('invalid_format'),
  @JsonValue('not_multiple_of')
  notMultipleOf('not_multiple_of'),
  @JsonValue('unrecognized_keys')
  unrecognizedKeys('unrecognized_keys'),
  @JsonValue('invalid_union')
  invalidUnion('invalid_union'),
  @JsonValue('invalid_key')
  invalidKey('invalid_key'),
  @JsonValue('invalid_element')
  invalidElement('invalid_element'),
  @JsonValue('invalid_value')
  invalidValue('invalid_value'),
  @JsonValue('custom')
  custom('custom');

  const ValidationIssueCode(this.json);

  final String? json;
  String toJson() {
    final value = json;
    if (value == null) {
      throw StateError(
        'Cannot convert enum value with null JSON representation to String. '
        'This usually happens for \$unknown or @JsonValue(null) entries.',
      );
    }
    return value as String;
  }

  @override
  String toString() => json?.toString() ?? super.toString();
}
