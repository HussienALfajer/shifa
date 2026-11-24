// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'add_member_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AddMemberRequest _$AddMemberRequestFromJson(Map<String, dynamic> json) =>
    AddMemberRequest(
      name: json['name'] as String,
      phone: json['phone'] as String,
      roles: (json['roles'] as List<dynamic>)
          .map((e) => RoleScopeInput.fromJson(e as Map<String, dynamic>))
          .toList(),
      permissions: (json['permissions'] as List<dynamic>?)
          ?.map((e) => PermissionSetting.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$AddMemberRequestToJson(AddMemberRequest instance) =>
    <String, dynamic>{
      'name': instance.name,
      'permissions': ?instance.permissions,
      'phone': instance.phone,
      'roles': instance.roles,
    };
