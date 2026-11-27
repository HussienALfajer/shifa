// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'flag_clinic.g.dart';

@JsonSerializable()
class FlagClinic {
  const FlagClinic({required this.id, required this.name});

  factory FlagClinic.fromJson(Map<String, Object?> json) =>
      _$FlagClinicFromJson(json);

  final String id;
  final String name;

  Map<String, Object?> toJson() => _$FlagClinicToJson(this);
}
