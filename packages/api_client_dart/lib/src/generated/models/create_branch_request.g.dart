// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_branch_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateBranchRequest _$CreateBranchRequestFromJson(Map<String, dynamic> json) =>
    CreateBranchRequest(
      name: json['name'] as String,
      address: json['address'] as String?,
      areaId: json['areaId'] as String?,
      cityId: json['cityId'] as String?,
      phone: json['phone'] as String?,
    );

Map<String, dynamic> _$CreateBranchRequestToJson(
  CreateBranchRequest instance,
) => <String, dynamic>{
  'address': ?instance.address,
  'areaId': ?instance.areaId,
  'cityId': ?instance.cityId,
  'name': instance.name,
  'phone': ?instance.phone,
};
