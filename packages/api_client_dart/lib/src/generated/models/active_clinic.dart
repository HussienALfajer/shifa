// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'active_clinic.g.dart';

@JsonSerializable()
class ActiveClinic {
  const ActiveClinic({required this.branchId, required this.tenantId});

  factory ActiveClinic.fromJson(Map<String, Object?> json) =>
      _$ActiveClinicFromJson(json);

  @JsonKey(includeIfNull: true)
  final String? branchId;
  final String tenantId;

  Map<String, Object?> toJson() => _$ActiveClinicToJson(this);
}
