// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Stable machine-readable error code.
@JsonEnum()
enum ErrorCode {
  @JsonValue('bad_request')
  badRequest('bad_request'),
  @JsonValue('validation_failed')
  validationFailed('validation_failed'),
  @JsonValue('unauthorized')
  unauthorized('unauthorized'),
  @JsonValue('forbidden')
  forbidden('forbidden'),
  @JsonValue('not_found')
  notFound('not_found'),
  @JsonValue('method_not_allowed')
  methodNotAllowed('method_not_allowed'),
  @JsonValue('not_acceptable')
  notAcceptable('not_acceptable'),
  @JsonValue('request_timeout')
  requestTimeout('request_timeout'),
  @JsonValue('conflict')
  conflict('conflict'),
  @JsonValue('payload_too_large')
  payloadTooLarge('payload_too_large'),
  @JsonValue('uri_too_long')
  uriTooLong('uri_too_long'),
  @JsonValue('unsupported_media_type')
  unsupportedMediaType('unsupported_media_type'),
  @JsonValue('unprocessable_entity')
  unprocessableEntity('unprocessable_entity'),
  @JsonValue('too_many_requests')
  tooManyRequests('too_many_requests'),
  @JsonValue('internal_error')
  internalError('internal_error'),
  @JsonValue('service_unavailable')
  serviceUnavailable('service_unavailable');

  const ErrorCode(this.json);

  final String? json;
  String toJson() {
    final value = json;
    if (value == null) {
      throw StateError(
        'Cannot convert enum value with null JSON representation to String. '
        'This usually happens for \$unknown or @JsonValue(null) entries.',
      );
    }
    return value as String;
  }

  @override
  String toString() => json?.toString() ?? super.toString();
}
