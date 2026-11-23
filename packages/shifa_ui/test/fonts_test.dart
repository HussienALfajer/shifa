// The fonts the tokens build copies into fonts/ are declared (slice 0.4-08);
// their licences are registered by registerShifaLicences (licences_test.dart).
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

void main() {
  test('pubspec.yaml declares every TTF of fonts/ under its weight', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();
    final ttfs = Directory('fonts')
        .listSync()
        .map((f) => f.uri.pathSegments.last)
        .where((name) => name.endsWith('.ttf'))
        .toList();
    expect(ttfs, hasLength(6));
    for (final name in ttfs) {
      final weight = RegExp(r'-(\d{3})\.ttf$').firstMatch(name)!.group(1);
      expect(
        pubspec,
        contains('- asset: fonts/$name\n          weight: $weight'),
        reason: name,
      );
    }
    expect(pubspec, contains('- family: Shifa Sans Arabic'));
    expect(pubspec, contains('- family: Noto Naskh Arabic'));
  });

  test('the token families are the declared families', () {
    expect(ShifaTokens.textFamilyUi.first, 'Shifa Sans Arabic');
    expect(ShifaTokens.textFamilyReading.first, 'Noto Naskh Arabic');
  });
}
