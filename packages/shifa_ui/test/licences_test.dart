// The licences of what shifa_ui ships reach the app's licence page (slice
// 0.4-08 for the fonts; slice 0.4-12, P-N7, for the Solar icons, CC BY 4.0,
// drawn by the painters in glyphs.g.dart).
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

String _text(LicenseEntry entry) =>
    entry.paragraphs.map((p) => p.text).join('\n');

void main() {
  test(
    'registerShifaLicences adds both font OFLs and the Solar licence',
    () async {
      final bundle = _Bundle();
      registerShifaLicences(bundle: bundle);
      final entries = await LicenseRegistry.licenses.toList();

      final fonts = entries
          .where((e) => e.packages.any((p) => p.contains('Arabic')))
          .toList();
      expect(fonts, hasLength(2));
      for (final entry in fonts) {
        expect(_text(entry), contains('SIL OPEN FONT LICENSE'));
      }
      expect(bundle.requested, [
        'packages/shifa_ui/fonts/ibm-plex-sans-arabic-OFL.txt',
        'packages/shifa_ui/fonts/noto-naskh-arabic-OFL.txt',
      ]);

      final solar = entries
          .where((e) => e.packages.any((p) => p.contains('Solar')))
          .toList();
      expect(solar, hasLength(1));
      final text = _text(solar.single);
      expect(text, contains('480 Design'));
      expect(text, contains('CC BY 4.0'));
      expect(text, contains('https://creativecommons.org/licenses/by/4.0/'));
    },
  );
}
