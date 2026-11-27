// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_branch_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateBranchRequest _$UpdateBranchRequestFromJson(Map<String, dynamic> json) =>
    UpdateBranchRequest(
      address: json['address'] as String?,
      areaId: json['areaId'] as String?,
      cityId: json['cityId'] as String?,
      name: json['name'] as String?,
      phone: json['phone'] as String?,
    );

Map<String, dynamic> _$UpdateBranchRequestToJson(
  UpdateBranchRequest instance,
) => <String, dynamic>{
  'address': ?instance.address,
  'areaId': ?instance.areaId,
  'cityId': ?instance.cityId,
  'name': ?instance.name,
  'phone': ?instance.phone,
};
