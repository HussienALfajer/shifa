// Criteria 7–8: the Dart port gives every key of the shared vector file (the same file the
// TypeScript port and the SQL function run) and is idempotent.
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:s3_normaliser/normalise.dart';
import 'package:test/test.dart';

final Map<String, dynamic> _vectors = jsonDecode(
  File('../vectors/name-search-vectors.json').readAsStringSync(),
) as Map<String, dynamic>;
final List<Map<String, dynamic>> _cases = (_vectors['cases'] as List<dynamic>)
    .cast<Map<String, dynamic>>();

/// Same alphabet as the TypeScript property test.
final List<String> _alphabet = <String>[
  ..._splitChars(
    'ابتثجحخدذرزسشصضطظعغفقكلمنهويءأإآٱؤئةىکی٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹0123456789abcXYZKÖé-',
  ),
  '\u064B',
  '\u064E',
  '\u0650',
  '\u0651',
  '\u0652',
  '\u0653',
  '\u0654',
  '\u0655',
  '\u0670',
  '\u06D6',
  '\u0640',
  '\u0301',
  '\u0308',
  ' ',
  ' ',
  ' ',
  '\u00A0',
  '\u200C',
  '\u200D',
  '\u200E',
  '\u200F',
  '\u2003',
  '\t',
  '\u212A',
  'عبد ',
  'أبو ',
  'ابي ',
  'أم ',
  'ابن ',
  'بن ',
  'بنت ',
  'ت ',
];

List<String> _splitChars(String s) => s.runes.map(String.fromCharCode).toList();

void main() {
  test('the vector file holds at least 200 cases', () {
    expect(_cases.length, greaterThanOrEqualTo(200));
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
      final once = normaliseName(c['input'] as String);
      expect(normaliseName(once), once, reason: c['id'] as String);
    }
  });

  test('idempotent over 5,000 seeded random strings', () {
    final alphabet = [
      for (final entry in _alphabet)
        if (entry.length > 1 && !entry.endsWith(' '))
          ..._splitChars(entry)
        else
          entry,
    ];
    final random = Random(30003);
    for (var i = 0; i < 5000; i++) {
      final length = random.nextInt(25);
      final buffer = StringBuffer();
      for (var k = 0; k < length; k++) {
        buffer.write(alphabet[random.nextInt(alphabet.length)]);
      }
      final input = buffer.toString();
      final once = normaliseName(input);
      expect(normaliseName(once), once, reason: jsonEncode(input));
    }
  });
}
