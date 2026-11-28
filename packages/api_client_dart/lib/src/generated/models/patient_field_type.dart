// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum PatientFieldType {
  @JsonValue('text')
  text('text'),
  @JsonValue('long_text')
  longText('long_text'),
  @JsonValue('number')
  number('number'),
  @JsonValue('date')
  date('date'),
  @JsonValue('single_choice')
  singleChoice('single_choice'),
  @JsonValue('multi_choice')
  multiChoice('multi_choice'),
  @JsonValue('yes_no')
  yesNo('yes_no'),
  @JsonValue('phone')
  phone('phone');

  const PatientFieldType(this.json);

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
