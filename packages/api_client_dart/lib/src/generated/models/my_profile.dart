// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'my_profile.g.dart';

@JsonSerializable()
class MyProfile {
  const MyProfile({
    required this.name,
    required this.phoneE164,
    required this.userId,
  });

  factory MyProfile.fromJson(Map<String, Object?> json) =>
      _$MyProfileFromJson(json);

  final String name;
  final String phoneE164;
  final String userId;

  Map<String, Object?> toJson() => _$MyProfileToJson(this);
}
