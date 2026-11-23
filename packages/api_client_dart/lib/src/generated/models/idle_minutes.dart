// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum IdleMinutes {
  @JsonValue(15)
  value15(15),
  @JsonValue(30)
  value30(30),
  @JsonValue(60)
  value60(60);

  const IdleMinutes(this.json);

  final num? json;
  num toJson() {
    final value = json;
    if (value == null) {
      throw StateError(
        'Cannot convert enum value with null JSON representation to num. '
        'This usually happens for \$unknown or @JsonValue(null) entries.',
      );
    }
    return value as num;
  }

  @override
  String toString() => json?.toString() ?? super.toString();
}
