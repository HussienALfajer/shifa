// The fonts the tokens build copies into fonts/ are declared and licensed
// (slice 0.4-08).
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

class _Bundle extends CachingAssetBundle {
  final requested = <String>[];

  @override
  Future<ByteData> load(String key) async {
    requested.add(key);
    final file = File(key.replaceFirst('packages/shifa_ui/', ''));
    return ByteData.sublistView(file.readAsBytesSync());
  }
}

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

  test(
    'registerShifaFontLicences adds both OFLs to the licence page',
    () async {
      final bundle = _Bundle();
      registerShifaFontLicences(bundle: bundle);
      final entries = await LicenseRegistry.licenses.toList();
      final ours = entries
          .where((e) => e.packages.any((p) => p.contains('Arabic')))
          .toList();
      expect(ours, hasLength(2));
      for (final entry in ours) {
        final text = entry.paragraphs.map((p) => p.text).join('\n');
        expect(text, contains('SIL OPEN FONT LICENSE'));
      }
      expect(bundle.requested, [
        'packages/shifa_ui/fonts/ibm-plex-sans-arabic-OFL.txt',
        'packages/shifa_ui/fonts/noto-naskh-arabic-OFL.txt',
      ]);
    },
  );
}
