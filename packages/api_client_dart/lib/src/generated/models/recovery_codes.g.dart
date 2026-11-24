// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'recovery_codes.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RecoveryCodes _$RecoveryCodesFromJson(Map<String, dynamic> json) =>
    RecoveryCodes(
      recoveryCodes: (json['recoveryCodes'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
    );

Map<String, dynamic> _$RecoveryCodesToJson(RecoveryCodes instance) =>
    <String, dynamic>{'recoveryCodes': instance.recoveryCodes};
