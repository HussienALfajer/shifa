// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum PatientMatchKind {
  @JsonValue('name')
  name('name'),
  @JsonValue('name_variant')
  nameVariant('name_variant'),
  @JsonValue('name_order')
  nameOrder('name_order'),
  @JsonValue('phone')
  phone('phone'),
  @JsonValue('phone_tail')
  phoneTail('phone_tail'),
  @JsonValue('file_number')
  fileNumber('file_number'),
  @JsonValue('previous_file_number')
  previousFileNumber('previous_file_number'),
  @JsonValue('custom_field')
  customField('custom_field');

  const PatientMatchKind(this.json);

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
