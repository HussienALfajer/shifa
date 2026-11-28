// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'treating_doctor.g.dart';

@JsonSerializable()
class TreatingDoctor {
  const TreatingDoctor({
    required this.active,
    required this.memberId,
    required this.name,
  });

  factory TreatingDoctor.fromJson(Map<String, Object?> json) =>
      _$TreatingDoctorFromJson(json);

  final bool active;
  final String memberId;
  final String name;

  Map<String, Object?> toJson() => _$TreatingDoctorToJson(this);
}
