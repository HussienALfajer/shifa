// Runs before every test file (flutter_test's hook): alchemist's golden
// settings and the real fonts.
//
// CI goldens (text drawn as blocks, the same on every OS) are committed under
// goldens/ci/ and compared in verify. Platform goldens with readable text are
// for looking at locally only (git-ignored):
//   SHIFA_PLATFORM_GOLDENS=1 node ../../scripts/dart.mjs flutter test \
//     --update-goldens test/goldens
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:alchemist/alchemist.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  await _loadShifaFonts();
  final platform = Platform.environment['SHIFA_PLATFORM_GOLDENS'] == '1';
  await AlchemistConfig.runWithConfig(
    config: AlchemistConfig(
      platformGoldensConfig: PlatformGoldensConfig(
        enabled: platform,
        filePathResolver: _beside,
      ),
      ciGoldensConfig: const CiGoldensConfig(filePathResolver: _beside),
    ),
    run: testMain,
  );
}

/// Golden tests live in test/goldens/; their images go to
/// `test/goldens/ci/` (or `windows/`, `linux/`, `macos/`).
String _beside(String fileName, String environmentName) =>
    '${environmentName.toLowerCase()}/$fileName.png';

/// Widgets ask for `packages/shifa_ui/<family>` (their TextStyle names the
/// package); inside this package's own tests the manifest lists the bare
/// family, so each family is loaded under the package name too.
Future<void> _loadShifaFonts() async {
  final manifest = json.decode(
    await rootBundle.loadString('FontManifest.json'),
  ) as List<dynamic>;
  for (final entry in manifest.cast<Map<String, dynamic>>()) {
    final family = entry['family'] as String;
    if (family.startsWith('packages/')) continue;
    final loader = FontLoader('packages/shifa_ui/$family');
    for (final font
        in (entry['fonts'] as List<dynamic>).cast<Map<String, dynamic>>()) {
      loader.addFont(rootBundle.load(font['asset'] as String));
    }
    await loader.load();
  }
}
