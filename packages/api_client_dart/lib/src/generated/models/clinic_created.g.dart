// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clinic_created.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClinicCreated _$ClinicCreatedFromJson(Map<String, dynamic> json) =>
    ClinicCreated(
      clinic: ClinicDetail.fromJson(json['clinic'] as Map<String, dynamic>),
      ownerLink: SetupLinkIssued.fromJson(
        json['ownerLink'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$ClinicCreatedToJson(ClinicCreated instance) =>
    <String, dynamic>{
      'clinic': instance.clinic,
      'ownerLink': instance.ownerLink,
    };
