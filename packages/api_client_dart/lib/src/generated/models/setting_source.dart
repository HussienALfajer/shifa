// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum SettingSource {
  /// The name has been replaced because it contains a keyword. Original name: `default`.
  @JsonValue('default')
  valueDefault('default'),
  @JsonValue('platform')
  platform('platform'),
  @JsonValue('plan')
  plan('plan'),
  @JsonValue('specialty_pack')
  specialtyPack('specialty_pack'),
  @JsonValue('organization')
  organization('organization'),
  @JsonValue('branch')
  branch('branch'),
  @JsonValue('practitioner')
  practitioner('practitioner'),
  @JsonValue('user')
  user('user');

  const SettingSource(this.json);

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
