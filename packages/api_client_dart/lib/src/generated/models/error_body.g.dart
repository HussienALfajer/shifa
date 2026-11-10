// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'error_body.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ErrorBody _$ErrorBodyFromJson(Map<String, dynamic> json) => ErrorBody(
  code: $enumDecode(_$ErrorCodeEnumMap, json['code']),
  message: json['message'] as String,
  details: (json['details'] as List<dynamic>?)
      ?.map((e) => ValidationIssue.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$ErrorBodyToJson(ErrorBody instance) => <String, dynamic>{
  'code': instance.code,
  'details': instance.details,
  'message': instance.message,
};

const _$ErrorCodeEnumMap = {
  ErrorCode.badRequest: 'bad_request',
  ErrorCode.validationFailed: 'validation_failed',
  ErrorCode.unauthorized: 'unauthorized',
  ErrorCode.forbidden: 'forbidden',
  ErrorCode.notFound: 'not_found',
  ErrorCode.methodNotAllowed: 'method_not_allowed',
  ErrorCode.notAcceptable: 'not_acceptable',
  ErrorCode.requestTimeout: 'request_timeout',
  ErrorCode.conflict: 'conflict',
  ErrorCode.payloadTooLarge: 'payload_too_large',
  ErrorCode.uriTooLong: 'uri_too_long',
  ErrorCode.unsupportedMediaType: 'unsupported_media_type',
  ErrorCode.unprocessableEntity: 'unprocessable_entity',
  ErrorCode.tooManyRequests: 'too_many_requests',
  ErrorCode.internalError: 'internal_error',
  ErrorCode.serviceUnavailable: 'service_unavailable',
};
