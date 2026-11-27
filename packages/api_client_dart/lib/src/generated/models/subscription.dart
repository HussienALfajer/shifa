// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'clinic_status.dart';
import 'clinic_type.dart';
import 'limit_use.dart';

part 'subscription.g.dart';

@JsonSerializable()
class Subscription {
  const Subscription({
    required this.features,
    required this.limits,
    required this.plan,
    required this.status,
    required this.subscriptionEnd,
  });

  factory Subscription.fromJson(Map<String, Object?> json) =>
      _$SubscriptionFromJson(json);

  final List<String> features;
  final List<LimitUse> limits;
  final ClinicType plan;
  final ClinicStatus status;
  @JsonKey(includeIfNull: true)
  final String? subscriptionEnd;

  Map<String, Object?> toJson() => _$SubscriptionToJson(this);
}
