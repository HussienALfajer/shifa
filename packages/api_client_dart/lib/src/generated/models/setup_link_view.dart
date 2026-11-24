// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'setup_link_purpose.dart';
import 'setup_link_role.dart';

part 'setup_link_view.g.dart';

@JsonSerializable()
class SetupLinkView {
  const SetupLinkView({
    required this.clinicName,
    required this.expiresAt,
    required this.personName,
    required this.phoneMasked,
    required this.purpose,
    required this.role,
  });

  factory SetupLinkView.fromJson(Map<String, Object?> json) =>
      _$SetupLinkViewFromJson(json);

  @JsonKey(includeIfNull: true)
  final String? clinicName;
  final DateTime expiresAt;
  final String personName;
  final String phoneMasked;
  final SetupLinkPurpose purpose;
  final SetupLinkRole role;

  Map<String, Object?> toJson() => _$SetupLinkViewToJson(this);
}
