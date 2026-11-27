// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'capabilities.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Capabilities _$CapabilitiesFromJson(Map<String, dynamic> json) => Capabilities(
  entitlements: Map<String, bool>.from(json['entitlements'] as Map),
  flags: Map<String, bool>.from(json['flags'] as Map),
  limits: (json['limits'] as List<dynamic>)
      .map((e) => LimitUse.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$CapabilitiesToJson(Capabilities instance) =>
    <String, dynamic>{
      'entitlements': instance.entitlements,
      'flags': instance.flags,
      'limits': instance.limits,
    };
