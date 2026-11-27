// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'announcement_clinic.g.dart';

@JsonSerializable()
class AnnouncementClinic {
  const AnnouncementClinic({required this.id, required this.name});

  factory AnnouncementClinic.fromJson(Map<String, Object?> json) =>
      _$AnnouncementClinicFromJson(json);

  final String id;
  final String name;

  Map<String, Object?> toJson() => _$AnnouncementClinicToJson(this);
}
