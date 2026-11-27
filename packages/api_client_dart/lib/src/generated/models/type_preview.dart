// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'clinic_type.dart';
import 'type_preview_limit.dart';

part 'type_preview.g.dart';

@JsonSerializable()
class TypePreview {
  const TypePreview({required this.limits, required this.type});

  factory TypePreview.fromJson(Map<String, Object?> json) =>
      _$TypePreviewFromJson(json);

  final List<TypePreviewLimit> limits;
  final ClinicType type;

  Map<String, Object?> toJson() => _$TypePreviewToJson(this);
}
