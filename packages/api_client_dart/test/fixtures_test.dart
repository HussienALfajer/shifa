// Shared response fixtures (packages/contracts/fixtures/responses.json)
// decode through the generated models, so the Dart and TypeScript clients
// are tested on the same data.
import 'dart:convert';
import 'dart:io';

import 'package:api_client_dart/api_client_dart.dart';
import 'package:test/test.dart';

typedef _Json = Map<String, dynamic>;

final _decoders = <String, Object Function(_Json)>{
  'HealthStatus': (json) => HealthStatus.fromJson(json).toJson(),
  'ErrorEnvelope': (json) => ErrorEnvelope.fromJson(json).toJson(),
};

_Json _readFixtures() {
  final file = File('../contracts/fixtures/responses.json');
  return jsonDecode(file.readAsStringSync()) as _Json;
}

/// JSON as it would go over the wire: nested models encoded, absent optional
/// fields dropped.
Object? _wire(Object? value) => _withoutNulls(jsonDecode(jsonEncode(value)));

Object? _withoutNulls(Object? value) => switch (value) {
  final Map<String, dynamic> map => {
    for (final e in map.entries)
      if (e.value != null) e.key: _withoutNulls(e.value),
  },
  final List<dynamic> list => list.map(_withoutNulls).toList(),
  _ => value,
};

void main() {
  final fixtures = _readFixtures();
  final valid = (fixtures['valid'] as List<dynamic>).cast<_Json>();
  final invalid = (fixtures['invalid'] as List<dynamic>).cast<_Json>();

  group('valid fixtures', () {
    for (final fixture in valid) {
      test('decode and round-trip: ${fixture['name']}', () {
        final decode = _decoders[fixture['schema']];
        expect(
          decode,
          isNotNull,
          reason: 'no decoder for ${fixture['schema']}',
        );
        final body = fixture['body'] as _Json;
        final encoded = _wire(decode!(body));
        if (fixture['extraFields'] == true) {
          // Fields added later are ignored, never fatal.
          expect(encoded, isA<Map<String, dynamic>>());
        } else {
          expect(encoded, equals(_wire(body)));
        }
      });
    }
  });

  group('invalid fixtures', () {
    for (final fixture in invalid) {
      test('are rejected: ${fixture['name']}', () {
        final decode = _decoders[fixture['schema']]!;
        expect(() => decode(fixture['body'] as _Json), throwsA(anything));
      });
    }
  });

  group('generated models keep the contract', () {
    test('an unknown error code is rejected, not mapped to a fallback', () {
      expect(
        () => ErrorEnvelope.fromJson({
          'error': {'code': 'im_a_teapot', 'message': 'Teapot'},
        }),
        throwsA(anything),
      );
    });

    test('string enums are exhaustive and keep their wire values', () {
      final codes = valid
          .where((f) => f['schema'] == 'ErrorEnvelope')
          .map((f) => ((f['body'] as _Json)['error'] as _Json)['code'])
          .toSet();
      expect(ErrorCode.values, hasLength(codes.length));
      expect(ValidationIssueCode.values, hasLength(11));
    });

    test('required fields are non-null and optional fields stay nullable', () {
      final envelope = ErrorEnvelope.fromJson({
        'error': {'code': 'not_found', 'message': 'Not found'},
      });
      // The explicit non-null types below are the check: they stop compiling
      // if the generator makes a required field nullable.
      // ignore: omit_local_variable_types
      final ErrorBody body = envelope.error;
      // Non-null type is the check.
      // ignore: omit_local_variable_types
      final String message = body.message;
      // Non-null type is the check.
      // ignore: omit_local_variable_types
      final ErrorCode code = body.code;
      expect(message, 'Not found');
      expect(code, ErrorCode.notFound);
      expect(body.details, isNull);

      final issues = ErrorEnvelope.fromJson({
        'error': {
          'code': 'validation_failed',
          'message': 'Validation failed',
          'details': [
            {'path': 'body.phone', 'code': 'invalid_format'},
          ],
        },
      }).error.details;
      expect(issues, hasLength(1));
      // Non-null type is the check.
      // ignore: omit_local_variable_types
      final String path = issues!.single.path;
      expect(path, 'body.phone');
      expect(issues.single.code, ValidationIssueCode.invalidFormat);
    });
  });
}
