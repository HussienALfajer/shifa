// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'feature_values.dart';
import 'flag_values.dart';
import 'limit_use.dart';

part 'capabilities.g.dart';

@JsonSerializable()
class Capabilities {
  const Capabilities({
    required this.entitlements,
    required this.flags,
    required this.limits,
  });

  factory Capabilities.fromJson(Map<String, Object?> json) =>
      _$CapabilitiesFromJson(json);

  final FeatureValues entitlements;
  final FlagValues flags;
  final List<LimitUse> limits;

  Map<String, Object?> toJson() => _$CapabilitiesToJson(this);
}
