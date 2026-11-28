// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum PatientRelation {
  @JsonValue('holder')
  holder('holder'),
  @JsonValue('son')
  son('son'),
  @JsonValue('daughter')
  daughter('daughter'),
  @JsonValue('husband')
  husband('husband'),
  @JsonValue('wife')
  wife('wife'),
  @JsonValue('father')
  father('father'),
  @JsonValue('mother')
  mother('mother'),
  @JsonValue('brother')
  brother('brother'),
  @JsonValue('sister')
  sister('sister'),
  @JsonValue('other')
  other('other');

  const PatientRelation(this.json);

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
