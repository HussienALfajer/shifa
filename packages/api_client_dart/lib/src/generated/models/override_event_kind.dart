// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum OverrideEventKind {
  /// The name has been replaced because it contains a keyword. Original name: `set`.
  @JsonValue('set')
  valueSet('set'),
  @JsonValue('changed')
  changed('changed'),
  @JsonValue('removed')
  removed('removed'),
  @JsonValue('expired')
  expired('expired'),
  @JsonValue('type_changed')
  typeChanged('type_changed');

  const OverrideEventKind(this.json);

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
