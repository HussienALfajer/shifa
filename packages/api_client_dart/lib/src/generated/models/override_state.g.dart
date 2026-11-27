// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'override_state.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OverrideState _$OverrideStateFromJson(Map<String, dynamic> json) =>
    OverrideState(
      expiresAt: json['expiresAt'] as String?,
      value: EntitlementValue.fromJson(json['value'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$OverrideStateToJson(OverrideState instance) =>
    <String, dynamic>{'expiresAt': instance.expiresAt, 'value': instance.value};
