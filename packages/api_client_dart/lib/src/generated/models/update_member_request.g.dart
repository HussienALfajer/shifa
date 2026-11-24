// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_member_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateMemberRequest _$UpdateMemberRequestFromJson(Map<String, dynamic> json) =>
    UpdateMemberRequest(
      name: json['name'] as String?,
      permissions: (json['permissions'] as List<dynamic>?)
          ?.map((e) => PermissionSwitch.fromJson(e as Map<String, dynamic>))
          .toList(),
      roles: (json['roles'] as List<dynamic>?)
          ?.map((e) => RoleScopeInput.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$UpdateMemberRequestToJson(
  UpdateMemberRequest instance,
) => <String, dynamic>{
  'name': ?instance.name,
  'permissions': ?instance.permissions,
  'roles': ?instance.roles,
};
