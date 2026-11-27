// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_setting_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicSettingList _$ClinicSettingListFromJson(Map<String, dynamic> json) =>
    ClinicSettingList(
      settings: (json['settings'] as List<dynamic>)
          .map((e) => SettingView.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$ClinicSettingListToJson(ClinicSettingList instance) =>
    <String, dynamic>{'settings': instance.settings};
