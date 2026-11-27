// A-03 criterion 6 (A-03-03; ADR-0052): the Dart port gives every key of the
// shared vector file (the file the TypeScript port runs) and is idempotent.
import 'dart:convert';
import 'dart:io';

import 'package:shifa_name_key/shifa_name_key.dart';
import 'package:test/test.dart';

final Map<String, dynamic> _vectors = jsonDecode(
  File('../contracts/vectors/name-search-vectors.json').readAsStringSync(),
) as Map<String, dynamic>;
final List<Map<String, dynamic>> _cases = (_vectors['cases'] as List<dynamic>)
    .cast<Map<String, dynamic>>();

void main() {
  test('the vectors are the version this port implements', () {
    expect(_vectors['version'], nameKeyVersion);
    expect(_cases.length, greaterThanOrEqualTo(300));
  });

  group('normaliseName (Dart) against the shared vectors', () {
    for (final c in _cases) {
      test(c['id'] as String, () {
        expect(normaliseName(c['input'] as String), c['key'] as String);
      });
    }
  });

  test('idempotent over every vector', () {
    for (final c in _cases) {
      final key = c['key'] as String;
      expect(normaliseName(key), key, reason: c['id'] as String);
    }
  });
}
